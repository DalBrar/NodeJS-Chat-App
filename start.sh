#!/bin/sh

/usr/bin/tmux new-session -d -s CHAT '/usr/bin/nodejs /var/www/chat.dalbrar.dev/index.js'

# list tmux windows:
#		tmux ls

# attach to tmux window
#		tmux a -t CHAT

# detach fr tmux window
#		CNTRL+b d
