/* Magic Mirror
 * Node Helper: Calendar
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var validUrl = require("valid-url");
var CalendarFetcher = require("./calendarfetcher.js");
var GoogleCalendarFetcher = require("./googlecalendarfetcher.js");
var fs = require("fs");

module.exports = NodeHelper.create({
	// Override start method.
	start: function() {
		var self = this;
		var events = [];

		this.fetchers = [];

		console.log("Starting node helper for: " + this.name);

	},

	// Override socketNotificationReceived method.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "ADD_CALENDAR") {
			//console.log('ADD_CALENDAR: ');
			this.createFetcher(payload.url, payload.fetchInterval, payload.maximumEntries, payload.maximumNumberOfDays, payload.user, payload.pass);
		}
        if (notification === "ADD_GOOGLE_CALENDAR") {
            this.createGoogleFetcher(payload.oauth_token, payload.calendar_id, payload.client_id, payload.client_secret, payload.fetchInterval, payload.maximumEntries, payload.maximumNumberOfDays);
        }
	},

	/* createFetcher(url, reloadInterval)
	 * Creates a fetcher for a new url if it doesn't exist yet.
	 * Otherwise it reuses the existing one.
	 *
	 * attribute url string - URL of the news feed.
	 * attribute reloadInterval number - Reload interval in milliseconds.
	 */

	createFetcher: function(url, fetchInterval, maximumEntries, maximumNumberOfDays, user, pass) {
		var self = this;

		if (!validUrl.isUri(url)) {
			self.sendSocketNotification("INCORRECT_URL", {url: url});
			return;
		}

		var fetcher;
		if (typeof self.fetchers[url] === "undefined") {
			console.log("Create new calendar fetcher for url: " + url + " - Interval: " + fetchInterval);
			fetcher = new CalendarFetcher(url, fetchInterval, maximumEntries, maximumNumberOfDays, user, pass);

			fetcher.onReceive(function(fetcher) {
				self.sendSocketNotification("CALENDAR_EVENTS", {
					id: fetcher.url(),
					events: fetcher.events()
				});
			});

			fetcher.onError(function(fetcher, error) {
				self.sendSocketNotification("FETCH_ERROR", {
					id: fetcher.url(),
					error: error
				});
			});

			self.fetchers[url] = fetcher;
		} else {
			//console.log('Use existing news fetcher for url: ' + url);
			fetcher = self.fetchers[url];
			fetcher.broadcastEvents();
		}

		fetcher.startFetch();
	},

    createGoogleFetcher: function(oauth_token, calendar_id, client_id, client_secret, fetchInterval, maximumEntries, maximumNumberOfDays) {
        var self = this;

		var fetcher; //Sure do love not having if as an expression
		if(typeof self.fetchers[client_id] !== "undefined") {
			fetcher = self.fetchers[client_id];
		} else {
			fetcher = new GoogleCalendarFetcher(client_id, client_secret, calendar_id, oauth_token, fetchInterval, maximumEntries, maximumNumberOfDays);

			fetcher.onReceive(function(events) {
				self.sendSocketNotification("CALENDAR_EVENTS", {
					id: client_id,
					events: events
				});
			});

			fetcher.onError(function(error){
				self.sendSocketNotification("FETCH_ERROR", {
					id: client_id,
					error: error,
				});
			});

			self.fetchers[client_id] = fetcher;
		}

		fetcher.startFetch();
    },

    // getNewToken: function(oauth2Client, callback) {
	// 	var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
    //     var authUrl = oauth2Client.generateAuthUrl({
    //         access_type: 'offline',
    //         scope: SCOPES
    //     });
	// 	console.log('Authorize this app by visiting this url: ' + authUrl);

    // }
});
