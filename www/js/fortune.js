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
        $(this).toggleClass('saved unsaved ui-btn-active').find('.ui-btn-text').html('Remove from Favorites');
        the_fortune.db.save_favorite( the_fortune.current_fortune_id );
      } else {
        $(this).toggleClass('unsaved saved ui-btn-active').find('.ui-btn-text').html('Add to Favorites');      
        the_fortune.db.remove_favorite( the_fortune.current_fortune_id );
      }
      return false;
    });

    $("#suppress").tap(function() {
      if ($(this).hasClass('normal')) {
        $(this).toggleClass('normal suppressed').attr('data-icon','plus').find('.ui-btn-text').html('Allow to Appear');
        $(this).find('.ui-icon').toggleClass('ui-icon-delete ui-icon-plus');
        the_fortune.db.hide( the_fortune.current_fortune_id );
      } else {
        $(this).addClass('normal suppressed').attr('data-icon','delete').find('.ui-btn-text').html("Don't Show Again");      
        $(this).find('.ui-icon').toggleClass('ui-icon-delete ui-icon-plus');
        the_fortune.db.show( the_fortune.current_fortune_id );
      }
      return false;
    });
  });
}

var file_system = 0;
var max_fortune_id = 482; //total count of fortunes. Will be fetched dynamically later...
var initial_count = 30;
var the_fortune = new fortuneObj();
var network_state = 0;
var dbase = 0;
var num_to_fetch = 2;
dbase = window.openDatabase('real_fortunes','1.0','RFDB', max_fortune_id * 32000); //set size for 32kb img avg

/**
 * Basic fortune object
 */
function fortuneObj() {

  this.current_fortune_id = 0;
  this.remote_server_url = "http://byrnecreative.com/fortune/f3/";
  this.fortune_ids = new Array();  
  this.needed = new Array();

  //constructs database and all that good stuff
  this.initialize = function() {
    //populate initial "needed" array
    for (i = initial_count; i <= max_fortune_id; i++) {
      this.needed.push( i );
    }
    //load up fortunes we have in the database, updating .needed and .fortune_ids
    this.db.init();
  }
  
  //put fortune into DOM
  this.publish_new = function() {
    new_fortune = this.db.load_fortune(false);
    $("#fortune-img").fadeOut("fast",function() {
      //show new
      $(this).attr("src", new_fortune.src).fadeIn("fast");
      //update tools if this is(n't) a favorite
      if ( new_fortune.fav ) {
        $('.unsaved').toggleClass('saved unsaved ui-btn-active').find('.ui-btn-text').html('Remove from Favorites');
      } else {
        $('.saved').toggleClass('unsaved saved ui-btn-active').find('.ui-btn-text').html('Add to Favorites');
      }
    });
  }
      
  //gets a new image from the server, saves it to DB and updates fortune_ids
  this.download_images = function( num ) {
    if (network_state == Connection.NONE) return;
    
    for (i = 0; i < num; i++) {
      //figure out what id to fetch
      new_index = Math.floor(Math.random() * this.needed.length); 
      new_id = this.needed[ new_index ];
      
      //get it
      $.getImageData({
        url: this.remote_server_url + lpad( new_id ) + '.jpg',
        success: function(image) {
          src = $(image).attr('src');
          //save it to DB
          this.db.create_fortune( new_id, src );
          //update arrays
          this.fortune_ids.push( new_id );
          this.needed.remove( new_id );
        },
        error: function(xhr,text_status) {}
      });
    }
  }
  
  this.db = {};
  
  //initialize the database and fortune_ids array
  this.db.init = function() {
    dbase.transaction(function(tx) {
      
      //try to create the table if needed
      tx.executeSql('CREATE TABLE IF NOT EXISTS fortunes( id unique, src, fav, hidden)');
      
      //query for a list of fortunes. If empty, populate it. If not, populate array
      tx.executeSql('SELECT * FROM fortunes', [], function(tx2, results){
        if (!results.rows.length) {
          for (i = 1; i <= initial_count; i++) {
            tx.executeSql('INSERT INTO fortunes VALUES ('+i+', "img/' + lpad(i) + '.jpg", 0, 0)');
            the_fortune.fortune_ids.push(i);
          }
        } else {
          for (i = 1; i <= results.rows.length; i++) {
            the_fortune.fortune_ids.push( results.rows.item(i).id );
            the_fortune.needed.remove( results.rows.item(i).id );
          }
        }
      }, the_fortune.db.error); //end call for querying list
      
    }, the_fortune.db.error, the_fortune.db.success); //end call for transaction
  }
  
  //load a fortune
  this.db.load_fortune = function( id ) {
    //if id, load a particular id. Otherwise grab a random
    ret = new Object();
    dbase.transaction(function(tx) {
      if ( id ) {
        tx.executeSql('SELECT * FROM fortunes WHERE id = '+id+' LIMIT 1', [], function(tx2,res) {
          //don't test to see if it worked, just assume it did for now
          ret = res.rows.item(0);
        }, the_fortune.db.error);
      } else {
        tx.executeSql('SELECT * FROM fortunes WHERE hidden != 1 AND id != '+the_fortune.current_fortune_id+' ORDER BY RANDOM() LIMIT 1', [], function(tx2,res) {
          //don't test to see if it worked, just assume it did for now
          ret = res.rows.item(0);
        }, the_fortune.db.error);
      }
    });
    return ret; //send back the object 
  }
  
  this.db.save_favorite = function( id ) {
    dbase.transaction(function(tx) {
      tx.executeSql('UPDATE fortunes SET fav = 1 WHERE id = '+id+' LIMIT 1');
    }, the_fortune.db.error);
  }
  
  this.db.remove_favorite = function( id ) {
    dbase.transaction(function(tx) {
      tx.executeSql('UPDATE fortunes SET fav = 0 WHERE id = '+id+' LIMIT 1');
    }, the_fortune.db.error);  
  }

  this.db.hide = function( id ) {
    dbase.transaction(function(tx) {
      tx.executeSql('UPDATE fortunes SET hidden = 1 WHERE id = '+id+' LIMIT 1');
    }, the_fortune.db.error);
  }
  
  this.db.show = function( id ) {
    dbase.transaction(function(tx) {
      tx.executeSql('UPDATE fortunes SET hidden = 0 WHERE id = '+id+' LIMIT 1');
    }, the_fortune.db.error);  
  }


  
  this.db.clear_entries = function( clear_type ) {
    //can clear either entire local downloads ('downloads')
    //or suppression list ('suppressions')
    dbase.transcation(function(tx){
      if (clear_type == 'downloads') {
        tx.executeSql('DELETE FROM fortunes WHERE src LIKE "%.jpg"');      
      } else {
        tx.executeSql('UPDATE fortunes SET hidden = 0 WHERE hidden = 1');
      }
    }, the_fortune.db.error);
  }
  
  this.db.create_fortune = function( id, src ) {
    dbase.transaction(function(tx){
      tx.executeSql('INSERT INTO fortunes VALUES ('+id+', "'+src+'", 0, 0)');
    }, the_fortune.db.error);
  }
  
  this.db.load_favorites = function() {
    ret = new Array();
    dbase.transaction(function(tx) {
      tx.executeSql('SELECT * FROM fortunes WHERE fav = 1', [], function(tx2, res) {
        for (var i=0; i < res.rows.length; i++) {
          ret[i] = res.rows.item(i);
        }
      }, the_fortune.db.error);
    }, the_fortune.db.error);
    
    return ret;//array of objects
  }
  
  this.db.error = function() {
    //well shit
  }

  this.db.success = function() {
    //oh good
  }
  
  //constructor
  this.initialize();
}



/**
 * Utility functions
 */

// String padding for filenames
lpad = function( value ) {
  string = value + "";
  while (string.length < 4)
    string = "0" + string;
  return string;
}

// Allow/disallow downloads if status changes
updateNetworkStatus = function() {
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