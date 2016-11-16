var google = require("googleapis");
var googleAuth = require("google-auth-library");
var moment = require("moment");
var Promise = require("bluebird");
var readline = require("readline");
var fs = require("fs");

var getNewToken = function(auth, token_filename) {
    const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
    var authUrl = auth.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log(
        '\n*****************************************************************************' +
        '\n* This appears to be the first time you are accessing this google calendar. *' + 
        '\n* Please authorize us to access your calendar by visiting the following url *' +
        '\n*****************************************************************************' );
    console.log(authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(function(fufill, reject) {
        rl.question('Enter the code from that page here: ', function(code) {
            rl.close();
            fufill(code);
        });
    })
    .then(code => new Promise(function(fufill, reject) {
        auth.getToken(code, function(err, token) {
            if(err) reject(err);
            else fufill(token);
        });
    }));
}

var GoogleCalendarFetcher = function(client_id, client_secret, calendar_name, calendar_id, maximumEntries, maximumNumberOfDays){
    var self = this;

    var reloadTimer = null;
    const TOKEN_FILENAME = calendar_name + '.json';
    
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(client_id, client_secret, "urn:ietf:wg:oauth:2.0:oob");
    
    var refreshAccessToken = Promise.promisify(oauth2Client.refreshAccessToken);

    var storeToken = function(token, filename) {
        var writeFile = Promise.promisify(fs.writeFile);
        return writeFile(filename, JSON.stringify(token));
    }
    
    var fullDayEvent = function(event) {
        var start = moment(event.start.datetime);
        var end = moment(event.end.datetime);
        var duration = start.utc() - end.utc();
        //I am not familiar with moment so this might be buggy logic
        //Trying to express an event is full day if there is exactly a days
        //worth time between it's start and end date
        return duration === moment.duration(1, 'days');
    }

    var fetchCalendar = function(oauth_client) { 

        var calendar = google.calendar('v3');
        var list = Promise.promisify(calendar.events.list);
        return new Promise(function(fufill, reject){
            calendar.events.list({
                auth: oauth_client,
                calendarId: calendar_id,
                timeMin: (new Date()).toISOString(),
                timeMax: moment().add(maximumNumberOfDays, 'days').toISOString(),
                maxResults: maximumEntries,
                singleEvents: true,
                orderBy: 'startTime'
            }, function(err, response) {
                if(err) {
                    console.log('error: ', err);
                    reject(err);
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

                fufill(events);
            });
        });
    };

    var readFile = Promise.promisify(fs.readFile);
    return readFile(TOKEN_FILENAME)
        .then(str_token => JSON.parse(str_token))
        .catch(err => {
            if(err.errno === -2) { //ENOENT file does not exist
                return getNewToken(oauth2Client)
                    .then(token => {
                        storeToken(token, TOKEN_FILENAME);
                        return token;
                    });
            }
        })
        .then(token => {
            oauth2Client.setCredentials(token);
            return fetchCalendar(oauth2Client);
        })
        .catch(err => {
            if(err.code === 401) {
                //If we are no longer authorized refresh token and try again
                return refreshAccessToken()
                    .then(token => {
                        storeToken(token, TOKEN_FILENAME)
                        oauth2Client.setCredentials(token)
                        return fetchCalendar(oauth2Client);
                    });
            }
        });
};

module.exports = GoogleCalendarFetcher;
