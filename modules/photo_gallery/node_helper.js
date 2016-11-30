var NodeHelper = require("node_helper");
var Promise = require("bluebird");
var fs = require("fs");
var path = require("path");

var conservativeCopyPhoto = function(src, dst) {
	return new Promise(function(resolve, reject) {
		//If photo has already been copied don't recopy it
		fs.access(dst, fs.constants.F_OK, (err) => {
			if(!err) {
				resolve();
				return;
			}
			var read = fs.createReadStream(src);
			read.on("error", reject);
			var write = fs.createWriteStream(dst);
			write.on("error", reject);
			write.on("close", resolve);
			read.pipe(write);
		});
	})
}

module.exports = NodeHelper.create({
	socketNotificationReceived: function(notification, payload) {
		if(notification === "LOAD_GALLERY") {
			console.log(path.resolve(payload.galleryDir));
			this.load_gallery(path.resolve(payload.galleryDir));
		}
	},

	load_gallery: function(dir) {
		var self = this;
		const EXTS = new Set([".jpg", ".jpeg", ".gif", ".png", ".svg", ".bmp", ".ico"]);
		var readdir = Promise.promisify(fs.readdir);
		readdir(dir)
			.catch(function(err){
				self.sendSocketNotification('IO_ERROR', {
					error: err
				});
			})
			.then(function(files) {
				console.log(files);
				var promises = files.map(function(file) {
					var ext = path.extname(file);
					if(!EXTS.has(ext)) return false;

					var source = dir + '/' + file;
					var target = __dirname + '/public/' + file;

					return conservativeCopyPhoto(source, target)
						.then(() => '/photo_gallery/' + file);
				});

				Promise.all(promises)
					.catch(function(err) {
						self.sendSocketNotification('IO_ERROR', {
							error: err
						})
						return Promise.reject(err); //Ensures then is not hit if err occurred
					})
					.then(function(files) {
						self.sendSocketNotification('GALLERY_LOADED', {
							gallery: files.filter(f => f !== false)
						});
					});
			})
	}
});