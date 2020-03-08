var express = require('express');
var app = express();
var http = require('http').createServer(app);
var favicon = require('serve-favicon');
var io = require('socket.io')(http);

const hostname = 'localhost';
const port = 3000;
const site = __dirname + '/site/';

// Favicon
app.use(favicon(site + 'favicon.ico'));
// Use Site Directory for HTML/CSS/Script files
app.use('/site', express.static('site'))

http.listen(port, function(){
	console.log(`Server running at http://${hostname}:${port}/`);
});

app.get('/', function(req, res){
	//res.send('<h1>Hello world</h1>');
	res.sendFile(site + 'index.html');
});


var numClients = 0;
var nicknames = new Set();
class msgHistory {
	constructor() {
		this.items = [];
	}
	add(msg) {
		this.items.push(msg);
		while (this.items.length > 200) {
			this.remove();
		}
	}
	remove() {
		if (this.items.length < 1) {}
		else
			return this.items.shift();
	}
	get() {
		return this.items;
	}
}
let history = new msgHistory();

io.on('connection', function(socket){
	let time = getTime();
	
	// Connection
		numClients++;
		socket.color = "D1DDDE";
		
		// set random nickname
		let username = "User" + Math.floor((Math.random() * 10000) + 1);
		while (nicknames.has(username)) {
			username = "User" + Math.floor((Math.random() * 10000) + 1);
		}
		nicknames.add(username);
		socket.username = username;
		updateNickname(socket);
		
		let inMsg = `${username} has connected ${time}: ` + numClients + ' users connected.';
		
		let addr = socket.handshake.headers["x-forwarded-for"];
		console.log(inMsg + ' on IP: ' + addr);
		
		socket.broadcast.emit('bc-connect', inMsg);
		socket.emit('bc-connect', 'You have connected to Chat. ' + (numClients - 1) + ' other users in chat.');
		socket.emit('info', 'To change your nickname type: /nick YourNickName');
		socket.emit('info', 'To change your name color type: /nickcolor RRGGBB');
		
		// send msg history
		let msgs = history.get();
		for (i = 0; i < msgs.length; i++) {
			socket.emit('chat message', {
					msg: msgs[i]
			});
		}
		
		// send online users list
		let onlineUsers = getCSList(nicknames);
		io.emit('update users', onlineUsers);
	
	// Disconnection
	socket.on('disconnect', function(){
		username = socket.username;
		nicknames.delete(username);
		time = getTime();
		numClients--;
		let outMsg = `${username} has disconnected ${time}: ` + numClients + ' users connected.';
		console.log(outMsg);
		socket.broadcast.emit('bc-disconnect', outMsg);
		
		// send online users list
		let onlineUsers = getCSList(nicknames);
		io.emit('update users', onlineUsers);
	});
	
	// Msg
	socket.on('chat message', function(msg){
		// if not empty msg
		if (msg) {
			if(msg.startsWith(" "))
				msg = "&nbsp;" + msg;
			
			// project against code injection
			msg = msg.replace(/</g, "&lt;").replace(/>/g, "&gt;");
			
			// check if /nickcolor command
			if (msg.startsWith("/nickcolor")) {
				let colorcode = msg.split(" ")[1];
				if (colorcode == null) {
					socket.emit('info', 'To change your nickname color type: /nick RRGGBB');
				}
				else {
					// valid color
					if (isHexColor(colorcode)) {
						socket.color = colorcode;
						let colorname = updateNickname(socket);
						socket.emit('info', `<span class="cor">Nickname changed to ${colorname}.</span>`);
					}
					// invalid color
					else {
						socket.emit('info', `<span class="err">The color code ${colorcode} is invalid. Must be a 6 digit Hex code.</span>`);
					}
				}
			}
			// check if /nick command
			else if (msg.startsWith("/nick")) {
				let newnick = msg.split(" ")[1];
				if (newnick == null) {
					socket.emit('info', 'To change your nickname type: /nick YourNickName');
				}
				else {
					// cancel: name exists
					if (nicknames.has(newnick)) {
						socket.emit('info', `<span class="err">The nickname ${newnick} is already taken. Try a different nickname.</span>`);
					}
					// set new name
					else {
						let oldnick = socket.username;
						nicknames.delete(oldnick);
						nicknames.add(newnick);
						socket.username = newnick;
						let colorname = updateNickname(socket);
						socket.emit('info', `<span class="cor">Nickname changed to ${colorname}.</span>`);
						let chngMsg = oldnick + ' changed their nickname to ' + newnick;
						console.log(chngMsg);
						socket.broadcast.emit('info', chngMsg);
						history.add('<span class="info">' + oldnick + ' changed their nickname to ' + newnick + '</span>');
						
						// send online users list
						let onlineUsers = getCSList(nicknames);
						io.emit('update users', onlineUsers);
					}
				}
			}
			// invalid command
			else if (msg.startsWith("/")) {
				socket.emit('info', `<span class="err">That is an invalid command! Valid commands are: /nick & /nickcolor</span>`);
			}
			// else regular msg
			else {
				time = getTime();
				console.log(socket.username + ' ' + time + ': ' + msg);
				let you = '<span style="color:#' + socket.color + '">You</span>';
				socket.emit('you message', {
					msg: `<p>${you} <span class="time">${time}</span>:</p>` + msg
				});
				let colorname = '<span style="color:#' + socket.color + '">' + socket.username + '</span>';
				let pubMsg = '<p>' + colorname + ` <span class="time"> ${time}</span>:</p>` + msg;
				socket.broadcast.emit('chat message', {
					msg: pubMsg
				});
				history.add(pubMsg);
			}
		}
	});
});

function getTime() {
	let d = new Date();
	
	let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	let day = days[d.getDay()];
	let month = months[d.getMonth()];
	
	let num = d.getDate();
	let yr = d.getYear();
	
	let hh = d.getHours();
	let ampm = "am";
	if (hh >= 12) ampm = "pm";
	if (hh > 12) hh -= 12;
	
	let mm = d.getMinutes();
	if (mm < 10) mm = "0" + mm;
	
	let time = 'on ' + day + ', ' + month + '. ' + num + '/' + yr + ' at ' + hh + ':' + mm + ' ' + ampm;
	
	return time;
}

// returns comma seperated list from give Set
function getCSList(mySet) {
	let names = "";
	let arr = Array.from(mySet);
	for (i = 0; i < arr.length; i++) {
		names = names + arr[i];
		if ((i+1) < arr.length)
			names += ", ";
	}
	return names;
}

function isHexColor(code) {
  return typeof code === 'string' && code.length === 6 && !isNaN(Number('0x' + code));
}

function updateNickname(socket) {
	let colorname = '<span style="color:#' + socket.color + ';">' + socket.username + '</span>';
	socket.emit('update nickname', {
		msg: colorname,
		name: socket.username,
		color: socket.color
	});
	return colorname;
}