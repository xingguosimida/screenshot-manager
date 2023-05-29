# Obsidian Screenshot Manager Plugin

## What

This is a screenshot management tool that references the correspondence between the source code and unit test files at
the directory hierarchy level.

Every time a note document is created, the plugin will create a corresponding folder under the resource directory
according to the file directory structure of the note to save all the screenshots in the note.

All screenshot files created by the user will be automatically moved to this folder. Accordingly, if the user deletes
the reference of a screenshot in the note, the corresponding screenshot will also be automatically deleted.

## How to use

1. Open your terminal.
2. Jump into `${vault_path}/.obsidian/plugins`.
3. Clone this repo.
4. Run `npm i`
4. Enable this plugin in your Obsidian.

## Demo

### Create

![create](https://github.com/xingguosimida/screenshot-manager/assets/129343145/508bdf83-5384-4a21-98c4-ca3beaa4e784)

### Delete

![delelte](https://github.com/xingguosimida/screenshot-manager/assets/129343145/fe9adf67-6470-45c9-9597-5d24476656e5)

