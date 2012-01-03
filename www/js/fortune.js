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
  
    //power it
    the_fortune.publish_new();
    
    $("#refresh, #fortune-img").bind('tap swipe', function() {
      the_fortune.publish_new();
      the_fortune.download_images( num_to_fetch );
    });
    
    $('#fortune-img').bind('taphold', function() {
      $('#tools').tap(); //will this work?
    }); 
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
        $(this).toggleClass('saved unsaved').find('.ui-btn-text').html('Remove from Favorites');
        the_fortune.db_save_favorite( current_fortune_id );
      } else {
        $(this).toggleClass('unsaved saved').find('.ui-btn-text').html('Add to Favorites');      
        the_fortune.db_remove_favorite( current_fortune_id );
      }
      return false;
    });

    $("#suppress").tap(function() {
      if ($(this).hasClass('normal')) {
        $(this).toggleClass('normal suppressed').attr('data-icon','plus').find('.ui-btn-text').html('Allow to Appear');
        $(this).find('.ui-icon').toggleClass('ui-icon-delete ui-icon-plus');
        the_fortune.db_hide( current_fortune_id );
      } else {
        $(this).addClass('normal suppressed').attr('data-icon','delete').find('.ui-btn-text').html("Don't Show Again");      
        $(this).find('.ui-icon').toggleClass('ui-icon-delete ui-icon-plus');
        the_fortune.db_show( current_fortune_id );
      }
      return false;
    });
  });
}

var file_system = 0;
var max_fortune_id = 482; //total count of fortunes. Will be fetched dynamically later...
var initial_count = 30;
var network_state = 0;
var dbase = window.openDatabase('real_fortunes','1.0','RFDB', max_fortune_id * 26000);
var fortune_ids = new Array();
var needed = new Array();
var num_to_fetch = 2;
var the_fortune = new fortuneObj();
var current_fortune_id = 0;
var ret = {};

/**
 * Basic fortune object
 */
function fortuneObj() {

  this.remote_server_url = "http://byrnecreative.com/fortune/f3/";

  //constructs database and all that good stuff
  this.initialize = function() {
    //populate initial "needed" array
    for (i = initial_count; i <= max_fortune_id; i++) {
      needed.push( i );
    }
    //load up fortunes we have in the database, updating .needed and .fortune_ids
    this.db_init();
  }
  
  //put fortune into DOM
  this.publish_new = function() {
    new_fortune = this.db_load_fortune(false);
  }  
  
  //gets a new image from the server, saves it to DB and updates fortune_ids
  this.download_images = function( num ) {
    if (network_state == Connection.NONE) return;
    
    for (i = 0; i < num; i++) {
      //figure out what id to fetch
      new_index = Math.floor(Math.random() * needed.length); 
      new_id = needed[ new_index ];
      console.log(this.remote_server_url + lpad( new_id ) + '.jpg');
      
      //get it
      $.getImageData({
        url: this.remote_server_url + lpad( new_id ) + '.jpg',
        success: function(image) {
          //console.log(image);
          src = $(image).attr('src');
          //save it to DB
          this.db_create_fortune( new_id, src );
          //update arrays
          fortune_ids.push( new_id );
          needed.remove( new_id );
        },
        error: function(xhr,text_status) {
          console.log('ajax failure');
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
          for (i = 1; i < results.rows.length; i++) {
            fortune_ids.push( results.rows.item(i).id );
            needed.remove( results.rows.item(i).id );
          }
        }
      }, new_db_error); //end call for querying list
      
    }, new_db_error, this.db_success); //end call for transaction
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
  }
  
  this.db_remove_favorite = function( id ) {
    dbase.transaction(function(tx) {
      tx.executeSql('UPDATE fortunes SET fav = 0 WHERE id = '+id);
    }, new_db_error);  
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
    dbase.transcation(function(tx){
      if (clear_type == 'downloads') {
        tx.executeSql('DELETE FROM fortunes WHERE src LIKE "%.jpg"');      
      } else {
        tx.executeSql('UPDATE fortunes SET hidden = 0 WHERE hidden = 1');
      }
    }, new_db_error);
  }
  
  this.db_create_fortune = function( id, src ) {
    dbase.transaction(function(tx){
      tx.executeSql('INSERT INTO fortunes VALUES ('+id+', "'+src+'", 0, 0)');
    }, new_db_error);
  }
  
  this.db_load_favorites = function() {
    ret = new Array();
    dbase.transaction(function(tx) {
      tx.executeSql('SELECT * FROM fortunes WHERE fav = 1', [], function(tx2, res) {
        for (var i=0; i < res.rows.length; i++) {
          ret[i] = res.rows.item(i);
        }
      }, new_db_error);
    }, new_db_error);
    
    return ret;//array of objects
  }
  
  //constructor
  this.initialize();
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
  network_status = navigator.network.connection.type;
  if (network_status == Connection.NONE) {
    navigation.notification.alert(
      'New fortunes will not be downloaded while no connection is present.',
      null,
      'Network Unavailable'
    );
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
  console.log(tx);
}

function switch_fortune( new_fortune ) {
  current_fortune_id = new_fortune.id;
  img = new Image();
  img.src = new_fortune.src; //preload
  
  $("#fortune-img").fadeOut("fast",function() {
    //show new
    $(this).attr("src", new_fortune.src).fadeIn("fast");
    //update tools if this is(n't) a favorite
    if ( new_fortune.fav ) {
      $('.unsaved').toggleClass('saved unsaved').find('.ui-btn-text').html('Remove from Favorites');
    } else {
      $('.saved').toggleClass('unsaved saved').find('.ui-btn-text').html('Add to Favorites');
    }
  });
}

onDeviceReady();