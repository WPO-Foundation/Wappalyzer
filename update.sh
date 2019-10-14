#!/bin/bash
git checkout master
git pull origin master
git fetch upstream
git checkout master
git merge upstream/master
git push
