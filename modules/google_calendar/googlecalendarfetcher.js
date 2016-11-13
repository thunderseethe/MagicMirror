var google = require("googleapis");
var googleAuth = require("google-auth-library");
var moment = require("moment");
var fs = require("fs");

var GoogleCalendarFetcher = function(client_id, client_secret, calendar_name, calendar_id, oauth_token, reloadInterval, maximumEntries, maximumNumberOfDays){
    var self = this;

    var reloadTimer = null;
    const TOKEN_FILENAME = calendar_name + '.json';
    //var events = [];
    token = oauth_token; //this is done so that token can be updated if it expires
    if(fs.existsSync(TOKEN_FILENAME)){
        token = JSON.parse(fs.readFileSync(TOKEN_FILENAME));
    }

    self.fetchFailedCallback = function(){};
    self.eventsReceivedCallback = function(){};

    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(client_id, client_secret, "http://127.0.0.1");
    oauth2Client.setCredentials(token);

    var fetchCalendar = function(fail, success){
        clearTimeout(reloadTimer);
        reloadTimer = null;

        var opts = {
            auth: oauth2Client,
            calendarId: calendar_id,
            timeMin: (new Date()).toISOString(),
            timeMax: moment().add(maximumNumberOfDays, 'days').toISOString(),
            maxResults: maximumEntries,
            singleEvents: true,
            orderBy: 'startTime'
        };

        var fullDayEvent = function(event){
            var start = moment(event.start.datetime);
            var end = moment(event.end.datetime);
            var duration = start.utc() - end.utc();
            //I am not familiar with moment so this might be buggy logic
            //Trying to express an event is full day if there is exactly a days
            //worth time between it's start and end date
            return duration === moment.duration(1, 'days');
        }

        var calendar = google.calendar('v3');
        calendar.events.list(opts, function(err, response){
            if(err) {
                fail(err, self);
                return;
            }

            var events = response.items.map(function(event){
                return {
                    title: event.summary,
                    startDate: moment(event.start.dateTime).format("x"),
                    endDate: moment(event.end.dateTime).format("x"),
                    fullDayEvent: fullDayEvent(event)
                };
            });

            success(events, self); //Ah the fun of asynchronous callbacks, almost a real return
        });
    };

    var scheduleTimer = function() {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(function() {
            fetchCalendar(self.fetchFailedCallback, self.eventsReceivedCallback);
            scheduleTimer();
        }, reloadInterval);
    };

    self.startFetch = function() {
        fetchCalendar(self.fetchFailedCallback, self.eventsReceivedCallback);
        scheduleTimer();
    };

    self.onReceive = function(callback) {
        self.eventsReceivedCallback = callback;
    };
    self.onError = function(callback) {
        self.fetchFailedCallback = function(err){
            if(err.code === 401){
                //Catch an unauthorized error and don't treat it as a real error
                oauth2Client.refreshAccessToken(function(err, tokens) {
                    if(err) {
                        callback(err);
                        return;
                    }
                    fs.writeFile(TOKEN_FILENAME, JSON.stringify(tokens), function(err) {
                        callback(err);
                    });
                });
            } else {
                callback(err);
            }
        };
    };
};

module.exports = GoogleCalendarFetcher;
