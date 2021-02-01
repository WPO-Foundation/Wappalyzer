#!/bin/bash
git checkout master
git pull origin master
git remote rm upstream || true
git remote add upstream https://github.com/AliasIO/wappalyzer.git
git fetch upstream
git checkout master
git merge upstream/master
git push
git remote rm upstream