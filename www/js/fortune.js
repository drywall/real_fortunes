//Listens for device ready
function onBodyLoad() {		
  document.addEventListener("deviceready", onDeviceReady, false);
  document.addEventListener("online", updateNetworkStatus, false);
  document.addEventListener("offline", updateNetworkStatus, false);
}

//where the magic happens
function onDeviceReady() {
  
  network_state = //navigator.network.connection.type;
  network_state = 0;
  
  //make sure we can fetch images
  $(document).bind('mobileinit', function() {
    $.mobile.allowCrossDomainPages = true;
    $.support.cors = true;
  });
  
  //behaviors for fortune page
  $("#fortunepage").live('pageinit', function(e) {
  
    //show an alert if no network connection
    if (network_state == Connection.NONE) {
      $("#nonetwork").click();
    }
  
    //power it
    the_fortune.publish_new();
    
    $("#refresh").tap(function() {
      the_fortune.publish_new();
      the_fortune.download_images( the_fortune.initial_fortunes.length );
    });  
    
    //check if it's a favorite and update accordingly
    
  });

  //formatting the fortune page
  $("#fortunepage").live('pageshow', function(e) {
    $(".container").height( $(".container").width() * .33375 );
    $(".container").css("margin-top", $(".container").height() / 2 );
  });

  //behaviors for tools 
  $("#toolspage").live('pageinit', function(e) {
    $("#favorite").tap(function() {
      if ($(this).hasClass('unsaved')) {
        $(this).toggleClass('saved ui-btn-active').find('.ui-btn-text').html('Remove from Favorites');
      } else {
        $(this).toggleClass('unsaved saved ui-btn-active').find('.ui-btn-text').html('Save to Favorites');      
      }
      return false;
    });

    $("#suppress").tap(function() {
      if ($(this).hasClass('normal')) {
        $(this).toggleClass('normal suppressed').attr('data-icon','plus').find('.ui-btn-text').html('Allow to Appear');
        $(this).find('.ui-icon').toggleClass('ui-icon-delete ui-icon-plus');
      } else {
        $(this).addClass('normal').removeClass('suppressed').attr('data-icon','delete').find('.ui-btn-text').html("Don't Show Again");      
        $(this).find('.ui-icon').toggleClass('ui-icon-delete ui-icon-plus');
      }
      return false;
    });
  });
}

var file_system = 0;
var max_fortune_id = 482; //total count of fortunes. Will be fetched dynamically later...
var the_fortune = new fortuneObj();
var network_state = 0;

/**
 * Basic fortune object
 */
function fortuneObj() {

  this.current_fortune_id = 0;
  this.local_fortunes = new Array();
  this.downloaded_fortunes = new Array();
  this.remote_server_url = "http://byrnecreative.com/fortune/f3/";
  
    
  //preloaded fortunes
  this.initial_fortunes = new Array(
    "img/0001.jpg",  
    "img/0002.jpg",  
    "img/0003.jpg",
    "img/0004.jpg",
    "img/0005.jpg"  
  );
  
  this.build_local_fortunes = function() {
  	//instead of concat use jQuery.extend to merge objects!
    this.local_fortunes = this.initial_fortunes.concat( this.downloaded_fortunes );
  };
    
  //return a fortune
  this.get_random_fortune = function() {    
    //get a new fortune that's different from the current one
    do {
      new_fortune_id = Math.floor(Math.random() * this.local_fortunes.length);
    } while (new_fortune_id == this.current_fortune_id);
    
    //make the new one the current one and return it
    this.current_fortune_id = new_fortune_id;
    return this.local_fortunes[ this.current_fortune_id ];
  }
  
  //put fortune into DOM
  this.publish_new = function() {
    new_fortune = this.get_random_fortune();
    $("#fortune-img").fadeOut("fast",function() {
      $(this).attr("src", new_fortune).fadeIn("fast");
    });
  }
  
  //preload local images
  this.preload_local_images = function() {
    var images = new Array();
    for (i = 0; i < this.local_fortunes.length; i++) {
      images[i] = new Image();
      images[i].src = this.local_fortunes[i];
    }
  }
  
  //load a new image from server and preload it
  this.fetch_new_image = function( id_to_fetch ) {
    filename = lpad(id_to_fetch) + ".jpg";
    this.downloaded_fortunes.push(this.remote_server_url + filename);
    image_preload = new Image();
    image_preload.src = this.remote_server_url + filename;
  }
  
  this.download_images = function( num ) {
    if (network_state != Connection.NONE) {
      for (i = this.local_fortunes.length; i <= this.local_fortunes.length+num && i <= max_fortune_id; i++) {
        this.fetch_new_image(i);
      }
      this.build_local_fortunes();
    }
    $("#msg").html(network_state);
  }
  
  this.build_local_fortunes();
  this.preload_local_images();
}

/**
 * String padding for filenames
 */
lpad = function( value ) {
  string = value + "";
  while (string.length < 4)
    string = "0" + string;
  return string;
}

/**
 * Allow/disallow downloads if status changes
 */
updateNetworkStatus = function() {
  network_status = navigator.network.connection.type;
}

//firing manually
onDeviceReady();