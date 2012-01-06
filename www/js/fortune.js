//Listens for device ready
function onBodyLoad() {		
  document.addEventListener("deviceready", onDeviceReady, false);
  document.addEventListener("online", updateNetworkStatus, false);
  document.addEventListener("offline", updateNetworkStatus, false);
}

//where the magic happens
function onDeviceReady() {
  
  toggleShaker();
  
  //make sure we can fetch images
  $(document).bind('mobileinit', function() {
    $.mobile.allowCrossDomainPages = true;
    $.support.cors = true;
    $.mobile.touchOverflowEnabled = false;
  });
  
  //behaviors for fortune page
  $("#fortunepage").live('pageinit', function(e) {

    //power it
    the_fortune.publish_new(false);
    
    $("#fortune-img").bind('tap swipe', function(e) {
      the_fortune.publish_new(false);
      the_fortune.download_images( num_to_fetch );
    });
    
    $('#fortune-img').bind('taphold', function() {
    	navigator.notification.vibrate(200);
    	$.mobile.changePage($("#toolspage"));
    });
     
  });

	//hack
	$.mobile.changePage($("#fortunepage"), {transition:'fade'});
	$("#intropage").on('pageshow', function() {
		$.mobile.changePage($("#fortunepage"), {transition:'fade'});	
	});

  // formatting the fortune page 
  $("#fortunepage").on('pageshow orientationchange', function(e) {
  	$(".container").height( $(".container").width() * .33375 );
  	myHeight = $(window).height();
  	newTop = (myHeight - $('.container').height() ) / 2; 
  	$(".container").css('margin-top', newTop - 45);
  	$(this).css('height',myHeight);
  });
  
	//fortunepage on exit
	$("#fortunepage").live('pagehide', function() {
		$("#fortune-back:visible").hide();
	});

  //behaviors for tools 
  $("#toolspage").live('pageinit', function(e) {

    $("#favorite").tap(function() {
      if ($(this).hasClass('unsaved')) {
        $(this).toggleClass('saved unsaved').find('.ui-btn-text').html('Remove from Favorites');
        $(".favorited").show();
        the_fortune.db_save_favorite( current_fortune_id );
      } else {
        $(this).toggleClass('unsaved saved').find('.ui-btn-text').html('Add to Favorites');
        $(".favorited").hide();
        the_fortune.db_remove_favorite( current_fortune_id );
      }
      return false;
    });

    $("#suppress").tap(function() {
      if ($(this).hasClass('normal')) {
        $(this).toggleClass('normal suppressed').attr('data-icon','plus').find('.ui-btn-text').html('Allow This One to Appear');
        $(this).find('.ui-icon').toggleClass('ui-icon-delete ui-icon-plus');
        the_fortune.db_hide( current_fortune_id );
      } else {
        $(this).addClass('normal suppressed').attr('data-icon','delete').find('.ui-btn-text').html("Don't Show This One Again");      
        $(this).find('.ui-icon').toggleClass('ui-icon-delete ui-icon-plus');
        the_fortune.db_show( current_fortune_id );
      }
      return false;
    });
        
    //tweeter!
  	$("#tweet").tap(function() {
  		window.plugins.twitter.sendTweet(
  			function(s) { console.log('RealFortune: Tweet sent'); },
  			function(f) { console.log('RealFortune: Tweet problem'); },
  			'Check out this fortune from my iOS app, @RealFortunes',
  			'',
  			the_fortune.remote_server_url + lpad(current_fortune_id) + ".jpg"
  		);    	
  	});
  });
  
  //behaviors for infopage
  $("#infopage").live('pageinit', function(e) {
   	$("#clear-hidden").tap(function() {
  		navigator.notification.confirm(
  			"This will allow all fortunes to be shown and cannot be undone.", 
  			function(response) {
  				if (response == 1) {
  					the_fortune.db_clear_entries('hidden');
  					navigator.notification.alert('Suppression list successfully cleared.', null_func, 'Great Success!');
  				}
  			}, 
  			"Warning", 
  			"Ok,Cancel");
  	});
  	$("#clear-downloads").tap(function() {
  		navigator.notification.confirm(
  			"Are you sure you want to delete all downloads? This will free up space on your device but reduce the number of fortunes available.", 
  			function(response) {
  				if (response == 1) {
						navigator.notification.alert( (fortune_ids.length - initial_count) +' downloaded fortunes successfully deleted.', null_func, 'Great Success!');
  					the_fortune.db_clear_entries('downloads');
  				}
  			}, 
  			"Warning", 
  			"Ok,Cancel");
  	});
  });
  
  //behaviors for favoritespage
  $("#favoritespage").live('pageinit', function(e) {
 		
 		$(this).on('pageshow', function() {
 			$(this).find('a').on('tap', function(e) {
				id_to_load = $(this).attr('id').substr(5);
				the_fortune.publish_new( id_to_load );
 				//$("#fortune-back").show();
 				$.mobile.changePage($('#fortunepage')); 
 			});
 		});
 		
 		//populate favorites
 		the_fortune.db_load_favorites();
 		
 		//make clear button work
 		$("#clear-faves").tap(function() {
			navigator.notification.confirm(
  			"This will erase your entire favorites list and cannot be undone.", 
  			function(response) {
  				if (response == 1) {
  					the_fortune.db_clear_entries('favorites');
  					navigator.notification.alert('Favorites list successfully cleared.', null_func, 'Great Success!');
  				}
  			}, 
  			"Warning", 
  			"Ok,Cancel"
  		);
  		return false;
  	});
  });
  
}

var firstload = 1;
var file_system = 0;
var max_fortune_id = 482; //total count of fortunes. Will be fetched dynamically later...
var initial_count = 30;
var network_state = 0;
var dbase = window.openDatabase('real_fortunes','1.0','RFDB', max_fortune_id * 26000);
var fortune_ids = new Array();
var needed = new Array();
var num_to_fetch = 1;
var the_fortune = new fortuneObj();
var current_fortune_id = 0;

/**
 * Basic fortune object
 */
function fortuneObj() {

  this.remote_server_url = "http://byrnecreative.com/fortune/f3/";

  //constructs database and all that good stuff
  this.initialize = function() {
    // get the max id
    $.get( this.remote_server_url + "max.json", function(data) {
    	max_fortune_id = data.max;
	    //re-populate initial "needed" array, overwriting db_init call
	    needed = [];
	    for (i = initial_count; i <= max_fortune_id; i++) {
	      if (!$.inArray(i, fortune_ids)) {
	      	needed.push(i);
	      }
	    }
    }, 'json');
    //gets reset during db_init as needed
    for (i = initial_count+1; i <= max_fortune_id; i++) {
      needed.push(i);
    }
    //load up fortunes we have in the database, updating .needed and .fortune_ids
    this.db_init();
  } 
  
  //put fortune into DOM
  this.publish_new = function( the_id ) {
    new_fortune = this.db_load_fortune( the_id );
  }  
  
  //gets a new image from the server, saves it to DB and updates fortune_ids
  this.download_images = function( num ) {
    if (network_state == Connection.NONE || network_state == Connection.UNKNOWN) return;
    
    for (i = 0; i < num; i++) {
      //figure out what id to fetch
      new_index = Math.floor(Math.random() * needed.length); 
      new_id = needed[ new_index ];
      
      //get it
      $.getImageData({
        url: this.remote_server_url + lpad( new_id ) + '.jpg',
        server: 'http://byrnecreative.com/fortune/getimagedata.php?callback=?',
        success: function(image) {
          src = $(image).attr('src');
          //save it to DB
          db_create_fortune( new_id, src );
          //update arrays
          fortune_ids.push( new_id );
          needed.remove( new_id );
        },
        error: function(xhr,text_status) {
          console.log('RealFortune: ajax failure!');
        }
      });
    }
  }
    
  //initialize the database and fortune_ids array
  this.db_init = function() {
    dbase.transaction(function(tx) {
      
      //try to create the table if needed
      tx.executeSql('CREATE TABLE IF NOT EXISTS fortunes( id unique, src, fav, hidden)');
      
      //query for a list of fortunes. If empty, populate it. If not, populate array
      tx.executeSql('SELECT * FROM fortunes', [], function(tx2, results){
        if (!results.rows.length) {
          for (i = 1; i <= initial_count; i++) {
            tx.executeSql('INSERT INTO fortunes VALUES ('+i+', "img/' + lpad(i) + '.jpg", 0, 0)');
            fortune_ids.push(i);
          }
        } else {
          for (i = 0; i < results.rows.length; i++) {
            fortune_ids.push( results.rows.item(i).id );
            needed.remove( results.rows.item(i).id );
          }
        }
      }, new_db_error); //end call for querying list
      
    }, new_db_error, db_success); //end call for transaction
  }
  
  //load a fortune
  this.db_load_fortune = function( id ) {
    //if id, load a particular id. Otherwise grab a random
    dbase.transaction(function(tx) {
      if ( id ) {
        tx.executeSql('SELECT * FROM fortunes WHERE id = '+id+' LIMIT 1', [], 
          function(tx2,res) {
            //don't test to see if it worked, just assume it did for now
            switch_fortune(res.rows.item(0));
          }, 
          new_db_error);
      } else {
        rand = Math.floor(Math.random() * fortune_ids.length);  //because ORDER BY random() is busted in webkit
        tx.executeSql('SELECT * FROM fortunes WHERE hidden != 1 AND id != '+current_fortune_id+' LIMIT 1 OFFSET '+rand, [], 
          function(tx2,res) {
            //don't test to see if it worked, just assume it did for now
            switch_fortune(res.rows.item(0));
          }, 
          new_db_error);
      }
    });
  }
  
  this.db_save_favorite = function( id ) {
    dbase.transaction(function(tx) {
      tx.executeSql('UPDATE fortunes SET fav = 1 WHERE id = '+id);
    }, new_db_error);
    this.db_load_favorites();
  }
  
  this.db_remove_favorite = function( id ) {
    dbase.transaction(function(tx) {
      tx.executeSql('UPDATE fortunes SET fav = 0 WHERE id = '+id);
    }, new_db_error);  
    this.db_load_favorites();
  }

  this.db_hide = function( id ) {
    dbase.transaction(function(tx) {
      tx.executeSql('UPDATE fortunes SET hidden = 1 WHERE id = '+id);
    }, new_db_error);
  }
  
  this.db_show = function( id ) {
    dbase.transaction(function(tx) {
      tx.executeSql('UPDATE fortunes SET hidden = 0 WHERE id = '+id);
    }, new_db_error);  
  }
  
  this.db_clear_entries = function( clear_type ) {
    //can clear either entire local downloads ('downloads')
    //or suppression list ('suppressions')
    dbase.transaction(function(tx){
      if (clear_type == 'downloads') {
        tx.executeSql('DELETE FROM fortunes WHERE id > '+initial_count); 
        //also clear fortune_ids and needed arrays
        needed = [];
        fortune_ids = [];
        for (i = 1; i <= max_fortune_id; i++) {
        	if (i <= initial_count) {
        		fortune_ids.push(i);
        	} else {
        		needed.push(i);
        	}
        }
      } else if (clear_type == 'favorites') {
        tx.executeSql('UPDATE fortunes SET fav = 0 WHERE fav = 1');
        $("#favorites-list li").remove();
        reload_favorites();
      } else {
        tx.executeSql('UPDATE fortunes SET hidden = 0 WHERE hidden = 1');
      } 
    }, new_db_error);
  }
  
  this.db_load_favorites = function() {
  	$("#favorites-list li").remove();
    dbase.transaction(function(tx) {
      tx.executeSql('SELECT * FROM fortunes WHERE fav = 1', [], function(tx2, res) {
        for (var i=0; i < res.rows.length; i++) {
          fav = res.rows.item(i);
          new_fave = '<li><a href="#" id="fave-'+fav.id+'"><img src="'+fav.src+'"></a></li>';
          $("#favoritespage #favorites-list").append(new_fave);
        }
        $("#favorites-list").listview('refresh').trigger('updatelayout');
      }, new_db_error);
    }, new_db_error);
  }
  
  //constructor
  this.initialize();
}

//insert fortunes
function db_create_fortune( id, src ) {
  dbase.transaction(function(tx){
    tx.executeSql('INSERT INTO fortunes(id,src,fav,hidden) VALUES ('+ id +', "'+src+'", 0, 0)');
  }, new_db_error);
}

/**
 * Utility functions
 */

// String padding for filenames
function lpad( value ) {
  string = value + "";
  while (string.length < 4)
    string = "0" + string;
  return string;
}

// Allow/disallow downloads if status changes
function updateNetworkStatus() {
  network_state = navigator.network.connection.type;
  if (network_state == Connection.NONE || network_state == Connection.UNKNOWN) {
  	$("#tweet").hide();
    navigator.notification.alert(
      "You won't be able to download new fortunes or send tweets without a connection.",
      null_func,
      'No Network Found'
    );
  } else {
  	if (window.plugins.twitter.isTwitterAvailable()) $("#tweet").show();
  }
}

//remove from arrays
Array.prototype.remove= function(){
  var what, a = arguments, L = a.length, ax;
  while(L && this.length){
    what = a[--L];
    while( (ax = this.indexOf(what)) != -1){
      this.splice(ax, 1);
    }
  }
  return this;
}

function new_db_error(tx,err) {
  console.log('RealFortune: DB error');
}

function switch_fortune( new_fortune ) {
  current_fortune_id = new_fortune.id;
  img = new Image();
  img.src = new_fortune.src; //preload?
  
  $("#fortune-img").fadeOut("fast",function() {
    //show new
    $(this).attr("src", new_fortune.src).delay(40).fadeIn("fast");
    //update tools if this is(n't) a favorite
    if ( new_fortune.fav ) {
    	$('.favorited').fadeIn('fast');
      $('.unsaved').toggleClass('saved unsaved').find('.ui-btn-text').html('Remove from Favorites');
    } else {
    	$('.favorited').fadeOut('fast');
      $('.saved').toggleClass('unsaved saved').find('.ui-btn-text').html('Add to Favorites');
    }
    //update suppression, just in case
		if ( new_fortune.hidden ) {
      $('.normal').toggleClass('normal suppressed').find('.ui-btn-text').html('Allow This One to Appear');
    } else {
      $('.suppressed').toggleClass('suppressed normal').find('.ui-btn-text').html("Don't Show This One Again");
    }
  });
}

//regen favorites list
function reload_favorites() {
	//$("#favorites-list").refresh();
	$("#favorites-list").listview('refresh'); 
}

//shake it like a polaroid picture
function on_shake_event() {
	if ($.mobile.activePage.attr('id') == "fortunepage" && $("#fortune-back:visible").length == 0) {
		the_fortune.publish_new(false);
	}
}

function null_func() {}

function db_success() {
	console.log('DB okay');
}