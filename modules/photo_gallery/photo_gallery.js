Module.register("photo_gallery", {
	defaults: {
		sliderSpeed: 60000, //1 minute
		photoDirectory: "photos/",
		animationSpeed: 2000,
		width: 300,
		height: 300,
		fade: true,
	},

	getStyles: function() {
		var styles = [
			this.file('gallery.css')
		];
		if(this.data.position.includes('fullscreen')) { //It's not guarenteed that start has been called yet so we can't use this.fullscreen
			styles.push(this.file('fullscreen.css'));
		}
		return styles;
	},

	start: function() {
		var photoDirectory = this.addTrailingSlash(this.config.photoDirectory);
		this.sendSocketNotification('LOAD_GALLERY', {
			galleryDir: photoDirectory
		});
		this.gallery = [];
		this.galleryIndex = 0;
		this.switchPhotoInterval = null; //Will hold timer for switching photos
		this.fullscreen = this.data.position.includes('fullscreen');
		if(this.fullscreen) {
			this.width = '100%';
			this.height = '100%';
		} else {
			this.width = this.config.width + 'px';
			this.height = this.config.height + 'px';
		}
	},

	socketNotificationReceived: function(notification, payload) {
		if(notification === 'GALLERY_LOADED') {
			console.log(payload.gallery);
			this.gallery = payload.gallery;	
			this.galleryIndex = 0;
			this.switchPhotoInterval = setInterval(this.switchPhoto.bind(this), this.config.sliderSpeed);
			this.updateDom(this.config.animationSpeed);
		}
		if(notification === 'IO_ERROR') {
			console.log(payload.error);
			//Cancel gallery on any error for now
			this.gallery = false;
			clearInterval(this.switchPhotoInterval);
			this.switchPhotoInterval = null;
			//error handling here one day
		}
	},



	getDom: function() {
		var div = document.createElement('div');
		if(this.fullscreen){
			div.classList.add('photo_gallery-fullscreen');
		}
		
		if(!this.gallery.length || this.gallery.length == 0) {

			div.classList.add('loading');
			div.appendChild(document.createTextNode('Gallery Loading...'));
			return div;

		} else {

			var img = document.createElement('img');
			img.setAttribute("src", this.gallery[this.galleryIndex]);
			img.setAttribute('width', this.width);
			img.setAttribute('height', this.height);
			div.appendChild(img);
			return div;
		}
	},
	switchPhoto: function() {
		this.galleryIndex += 1;
		console.log(this.gallery);
		if(this.galleryIndex >= this.gallery.length) {
			this.galleryIndex = 0;
		}
		this.updateDom(this.config.animationSpeed);
	},
	addTrailingSlash: function(dir) {
		if(dir[dir.length - 1] === '/') return dir;
		return dir + '/';
	}
});