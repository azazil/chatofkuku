module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
		this.app = app;
};

var handler = Handler.prototype;

/**
 * New client entry chat server.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next stemp callback
 * @return {Void}
 */
handler.enter = function(msg, session, next) {
	var self = this;
	var rid = msg.rid;
	var uid = msg.username + '*' + rid
	var sessionService = self.app.get('sessionService');

	//duplicate log in
	if( !! sessionService.getByUid(uid)) {
		next(null, {
			code: 500,
			error: true
		});
		return;
	}

	session.bind(uid);
	session.set('rid', rid);
	session.push('rid', function(err) {
		if(err) {
			console.error('set rid for session service failed! error is : %j', err.stack);
		}
	});
	session.on('closed', onUserLeave.bind(null, self.app));

	//put user into channel
	self.app.rpc.chat.chatRemote.add(session, uid, self.app.get('serverId'), rid, true, function(users){
		console.warn(uid + 'new chatroom connetor!!');
		next(null, {
			users:users
		});
	});
};

/**
 * client leave chat room.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next stemp callback
 * @return {Void}
 */
handler.leave = function(msg, session, next) {
	var self = this;
	var sessionService = self.app.get('sessionService');
	var oldRid = session.get('rid');
	var oldUid = msg.username + '*' + oldRid;

	//user not log in
	if( ! sessionService.getByUid(oldUid)) {
		next(null, {
			code: 500,
			error: true
		});
		return;
	}


	//kick user leave old channel
	self.app.rpc.chat.chatRemote.kick(session, oldUid, self.app.get('serverId'), oldRid, function(users){
		console.warn(oldUid + 'leave old chatroom!!');
		next(null, {
			users:users
		});
	});
	session.unbind(oldUid);
};

/**
 * User log out handler
 *
 * @param {Object} app current application
 * @param {Object} session current session object
 *
 */
var onUserLeave = function(app, session) {
	if(!session || !session.uid) {
		return;
	}
	app.rpc.chat.chatRemote.kick(session, session.uid, app.get('serverId'), session.get('rid'), null);
};