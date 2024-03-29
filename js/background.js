// Identifier used to debug the possibility of multiple instances of the
// extension making requests on behalf of a single user.
var animationFrames = 36;
var animationSpeed = 10; // ms
var canvas;
var canvasContext;
var loggedInImage;
var rotation = 0;
var loadingAnimation = new LoadingAnimation();

var unreadCount = 0 ;
var notificationsData = {} ;

var callbackForPopup ;

//loading & all errors has a issue if this is set to true
var no_conn_icon_on = false ;
var has_error = false ;
var firstCheck = true ;

function registerPopupCallback(callback){
	callbackForPopup = callback ;
}

function startChoseCheckers(sites){
	var oldData = notificationsData ;
	notificationsData = {} ;
	var order = 1 ;

	sites.forEach(function(site){
		var old = oldData[site] ;

		if(old){
			//exsits, copy it.
			notificationsData[site] = old ;
			oldData[site] = null ;		
		}else{
			//start new checker
			var checker ;
			if(site == "gmail"){
				checker = new GmailChecker() ;
			}else if(site == "facebook"){
				checker = new FacebookChecker() ;
			}else if(site == "hotmail"){
				checker = new HotmailChecker() ;
			}else if(site == "yahoom"){
				checker = new YahooMailChecker() ;
			}else if(site == "weibo"){
				checker = new SinaWeiboChecker() ;
			}else if(site == "baidu"){
				checker = new BaiduChecker() ;
			}else if(site == "163m"){
				checker = new Mail163Checker() ;
			}else if(site == "aolm"){
				checker = new AOLMailChecker() ;
			}else if(site == "sohum"){
				checker = new SohuMailChecker() ;
			}else if(site == "rmw"){
				checker = new RMWChecker() ;
			}else if(site == "baidu_tieba"){
				checker = new BaiduTiebaChecker() ;
			}else if(site == "renren"){
				checker = new RenRenChecker() ;
			}else if(site == "outlook"){
				checker = new OutlookChecker() ;
			}else{
				//unknown site
				console.error("register error. unknown new site:" + site) ;
			}

			if(checker){
				console.debug("register and start new checker:" + site) ;
				
				notificationsData[site] = {"result" : "init", "checker" : checker, "order" : order, "siteInfo" : checker.getSiteInfo()} ;
				
				checker.start() ;
			}
		}

		if(notificationsData[site]){
			notificationsData[site]["order"] = order++ ;
		}	
	}) ;

	//stop old checkers
	for(index in oldData){
		if(oldData[index] != null){
			console.debug("stop and destory old checker:" + oldData[index].checker.appName) ;
			
			oldData[index].checker.destory() ;
			delete oldData[index] ;
		}
	}
}


function getSavedSites(){
	var value = localStorage["fSites"];
	
	if(!value || value.length == 0){
		value = chrome.i18n.getMessage("defaultFSites") ;
	}
	
	return JSON.parse(value) ;
}

/**
* Store to selected sites to the localStorage and reload the checkers.
*/
function storeSavedSites(sitesArray){
	localStorage["fSites"] = JSON.stringify(sitesArray);
	startChoseCheckers(sitesArray) ;
	
	//options changed
	unreadCount = -1 ;
	repaintTips() ;
}

function getSortedNotifications(){
	
	return notificationsData ;
	
	//return notificationsData.sort(function(left, right){
	//	return left.order - right.order ;
	//}) ;

}

function updateViewPage(){
	if(callbackForPopup){
		callbackForPopup(getSortedNotifications()) ;
	}else{
		console.debug("popup page is not available.") ;
	}
}

function globalNotifyUnreadMessage(appName, dataArray){
	if(!appName){
		console.error("appName cann't be null. data:" + dataArray) ;
		return ;
	}
	
	var oldData = notificationsData[appName] ;
	if(oldData){
		delete oldData["result"] ;
		delete oldData["details"] ;
	}
	
	notificationsData[appName]["result"] = "success" ;
	notificationsData[appName]["details"] = dataArray ;
	
	console.debug("globalNotifyUnreadMessage for " + appName) ;
	
	repaintTips() ;
} ;
	
function globalNotifyError(appName, errorMsg){
	if(!appName){
		console.error("appName cann't be null. errorMsg:" + errorMsg) ;
		return ;
	}
	
	console.debug("globalNotifyError:" + errorMsg) ;

	var data = notificationsData[appName] ;
	if(data && data["result"] == "fail"){
		data["details"] = errorMsg ;
	}else{
		if(data){
			delete data["result"] ;
			delete data["details"] ;
		}
		
		notificationsData[appName]["result"] = "fail" ;
		notificationsData[appName]["details"] = errorMsg ;
		unreadCount = -1 ;
		
		repaintTips() ;
	}
}

function repaintTips(){
	var newUnReadCount = 0 ;
	var connectedSites = [] ;
	var m_hasFailedSite = false ;
	
	for(index in notificationsData){
		var data = notificationsData[index] ;
		
		if(data["result"] == "success"){
			for(item in data["details"]){
				newUnReadCount += data["details"][item]["unReadCount"] ;
			}
			
			connectedSites.push(data["siteInfo"]["text"]) ;
		}else if(data["result"] == "fail"){
			m_hasFailedSite = true ;
		}
	}
	
	var m_failStatusChanged = has_error != m_hasFailedSite ;
	has_error = m_hasFailedSite ;
	
	if(connectedSites.length == 0 && !no_conn_icon_on){
		//all error!
		no_conn_icon_on = true ;
    	loadingAnimation.stop();
    
		chrome.browserAction.setIcon({path:"/images/no_conn.png"});
	  	chrome.browserAction.setBadgeBackgroundColor({color:[190, 190, 190, 230]});
	  	chrome.browserAction.setBadgeText({text:"?"});
	}else if(connectedSites.length > 0){
		var m_value = localStorage["fSoundsOpitions"] ;
		
		if(m_value == "nosound"){
			//do nothing
		}else if(newUnReadCount > unreadCount){
			if(m_value == "always"){
				playSound() ;
			}else if(unreadCount == 0){ //once
				playSound() ;
			}
		}
		
    	loadingAnimation.stop();
		//some sites are connected.
		if(newUnReadCount != unreadCount || m_failStatusChanged || no_conn_icon_on || firstCheck){    	
			no_conn_icon_on = false ;
			firstCheck = false ;
			unreadCount = newUnReadCount ;
			animateFlip(unreadCount, m_hasFailedSite);
		}
	}
	
	chrome.browserAction.setTitle({title : chrome.i18n.getMessage("connectedSites") + connectedSites.join(", ")}) ;
	
	updateViewPage() ;
}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
	for(index in notificationsData){
		notificationsData[index].checker.tabsUpdated(tabId, changeInfo) ;
	}
});



// A "loading" animation displayed while we wait for the first response from
// Gmail. This animates the badge text with a dot that cycles from left to
// right.
function LoadingAnimation() {
  this.timerId_ = 0;
  this.maxCount_ = 8;  // Total number of states in animation
  this.current_ = 0;  // Current state
  this.maxDot_ = 4;  // Max number of dots in animation
}

LoadingAnimation.prototype.paintFrame = function() {
  var text = "";
  for (var i = 0; i < this.maxDot_; i++) {
    text += (i == this.current_) ? "." : " ";
  }
  if (this.current_ >= this.maxDot_)
    text += "";

  chrome.browserAction.setBadgeText({text:text});
  this.current_++;
  if (this.current_ == this.maxCount_)
    this.current_ = 0;
} ;

LoadingAnimation.prototype.start = function() {
  if (this.timerId_)
    return;

  var self = this;
  this.timerId_ = window.setInterval(function() {
    self.paintFrame();
  }, 100);
} ;

LoadingAnimation.prototype.stop = function() {
  if (!this.timerId_)
    return;

  window.clearInterval(this.timerId_);
  this.timerId_ = 0;
} ;

function init() {
  var m_sites = getSavedSites() ;
  
  if(m_sites.length > 0){
	  canvas = document.getElementById('canvas');
	  loggedInImage = document.getElementById('logged_in');
	  canvasContext = canvas.getContext('2d');
	
	  chrome.browserAction.setBadgeBackgroundColor({color:[208, 0, 24, 255]});
	  chrome.browserAction.setIcon({path: "/images/connected.png"});
	  loadingAnimation.start();

  	  startChoseCheckers(m_sites) ;
  }else{
  	repaintTips() ;
  }
}


function ease(x) {
  return (1-Math.sin(Math.PI/2+x*Math.PI))/2;
}

function animateFlip(msgCount, hasError) {
  rotation += 1/animationFrames;
  drawIconAtRotation();

  if (rotation <= 1) {
//    setTimeout("animateFlip(" + msgCount + "," + hasError + ")", animationSpeed);
	  setTimeout(function(){
		  animateFlip(msgCount, hasError) ;
	  }, animationSpeed);
  } else {
    rotation = 0;
    drawIconAtRotation();
    
    chrome.browserAction.setBadgeText({
      text: msgCount > 0 ? "" + msgCount : (hasError ? "?" : "")
    });
    chrome.browserAction.setBadgeBackgroundColor({color:[208, 0, 24, 255]});
  }
}

function drawIconAtRotation() {
  canvasContext.save();
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.translate(
      Math.ceil(canvas.width/2),
      Math.ceil(canvas.height/2));
  canvasContext.rotate(2*Math.PI*ease(rotation));
  canvasContext.drawImage(loggedInImage,
      -Math.ceil(canvas.width/2),
      -Math.ceil(canvas.height/2));
  canvasContext.restore();

  chrome.browserAction.setIcon({imageData:canvasContext.getImageData(0, 0,
      canvas.width,canvas.height)});
}

function openOptionsPageInTab(){
	var url = chrome.extension.getURL("options.html");
	chrome.tabs.create({url: url});
	
	return false ;
}

function playSound(){
	soundControl.play();
 }

window.addEventListener("load", init);
