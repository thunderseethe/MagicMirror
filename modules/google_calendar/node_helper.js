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
		} else if (notification === "ADD_GOOGLE_CALENDAR") {
        this.createGoogleFetcher(payload.calendar_id, payload.client_id, payload.client_secret, payload.calendar_name, payload.fetchInterval, payload.maximumEntries, payload.maximumNumberOfDays);
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

	createGoogleFetcher: function(calendar_id, client_id, client_secret, calendar_name, fetchInterval, maximumEntries, maximumNumberOfDays) {
    	var self = this;

		var fetcher;
		if(typeof self.fetchers[calendar_name] === "undefined") {
			var onReceive = function(events) {
				clearTimeout(self.fetchers[calendar_name]);
				self.fetchers[calendar_name] = null;
				
				self.sendSocketNotification("CALENDAR_EVENTS", {
					id: calendar_name,
					events: events
				});
				recurse(client_id, client_secret, calendar_name, calendar_id, maximumEntries, maximumNumberOfDays);
			}
			var onError = function(error) {
				self.sendSocketNotification("FETCH_ERROR", {
					id:calendar_name,
					error: error
				});
			}
			var recurse = function(client_id, client_secret, calendar_name, calendar_id, maximumEntries, maximumNumberOfDays) {
				self.fetchers[calendar_name] = setTimeout(function() {
					GoogleCalendarFetcher(client_id, client_secret, calendar_name, calendar_id, maximumEntries, maximumNumberOfDays)
						.then(onReceive)
						.catch(onError)
				}, fetchInterval);
			}
			GoogleCalendarFetcher(client_id, client_secret, calendar_name, calendar_id, maximumEntries, maximumNumberOfDays)
				.then(onReceive)
				.catch(onError);
		}
	},

});
