HOMEDIR = $(shell pwd)
USER = bot
SERVER = smidgeo
SSHCMD = ssh $(USER)@$(SERVER)
PROJECTNAME = namedlevels-bot
APPDIR = /opt/$(PROJECTNAME)

run:
	node post-levels-summary.js

pushall: sync
	git push origin master

sync:
	rsync -a $(HOMEDIR) $(USER)@$(SERVER):/opt --exclude node_modules/
	$(SSHCMD) "cd $(APPDIR) && npm install"

prettier:
	prettier --single-quote --write "**/*.js"
