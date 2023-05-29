import {Editor, EditorPosition, Plugin, TAbstractFile, TFile, TFolder} from 'obsidian';

const fs = require('fs');
const Diff = require('diff');


interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings
	filenamePattern: RegExp = /^(.+?)(?:\.png)?(?:\.md)?$/
	imgRegExp: RegExp = /^!\[(.*?)]\(resources\/.+\.png\)$/
	screenShotPath: string
	activeFileContent: string
	activeFileName: String

	async onload() {
		await this.loadSettings();

		this.registerEvent(this.app.vault.on('create', (file: TAbstractFile) => this.newFileHandler(file)));

		this.registerEvent(this.app.vault.on('delete', (file: TAbstractFile) => this.deleteFileHandler(file)));

		this.registerEvent(this.app.vault.on('modify', async (file: TAbstractFile) => this.modifyFileHandler(file)));

		this.registerEvent(this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => this.renameFileHandler(file, oldPath)));

		this.registerEvent(this.app.workspace.on("editor-change", this.onChange.bind(this)))

		this.registerEvent(this.app.workspace.on("file-open", async (file: TFile | null) => this.onFileOpen(file)))

	}


	async onChange(editor: Editor) {
		const pos: EditorPosition = editor.getCursor()
		const line: string = editor.getLine(pos.line)
		if (decodeURIComponent(line.trim()).startsWith("![](Pasted image")) {
			const orig: string | undefined = line.trim().replace("![[", "").replace("]]", "").split("|").first()
			if (orig) {
				const replacedString: string = line.replace(/\(.*\)/, `(${this.screenShotPath})`)
				editor.setLine(pos.line, replacedString)
				this.screenShotPath = ''
			}
		}
	}

	newFileHandler(file: TAbstractFile) {
		if (this.markdownFile(file)) {
			let resourcePath: string = this.resourcePath(file)
			let resourcePathFolder: TAbstractFile | null = this.app.vault.getAbstractFileByPath(resourcePath)
			if (!resourcePathFolder)
				this.app.vault.createFolder(resourcePath)
		}

		if (this.pngFile(file)) {
			let attachmentFolderPath = this.appConfiguration().attachmentFolderPath;

			let attachmentFolder: TAbstractFile | null = this.app.vault.getAbstractFileByPath(attachmentFolderPath)
			if (attachmentFolder) {
				// @ts-ignore
				const screenShot = attachmentFolder.children.find(tFile => "png" == tFile.extension)
				let currentFile: TFile | null = this.app.workspace.getActiveFile()
				if (currentFile) {
					let resourceFolderOfCurrentFile: string = this.resourcePath(currentFile)
					// @ts-ignore
					const existedFile = this.app.vault.getAbstractFileByPath(resourceFolderOfCurrentFile).children.find(tFile => tFile.name == file.name)
					if (!existedFile) {
						this.app.vault.rename(screenShot, `${resourceFolderOfCurrentFile}/${this.screenShotName()}`)
						this.screenShotPath = `${resourceFolderOfCurrentFile}/${this.screenShotName()}`;
					}
				}
			}
		}
	}

	async modifyFileHandler(file: TAbstractFile) {
		if (file instanceof TFile && this.activeFileContent) {
			let modifiedContent: string = await this.app.vault.read(file)
			let allDifference = Diff.diffChars(this.activeFileContent, modifiedContent)
			let deletedContent = allDifference.filter(item => item.removed).filter(item => this.imgRegExp.test(item.value))
			if (deletedContent.length == 0) {
				this.activeFileContent = modifiedContent
				return;
			}
			const resourceRegExp: RegExp = /resources\/(.+?).png/;
			const match: RegExpExecArray | null = resourceRegExp.exec(deletedContent[0].value);
			if (match && match[0]) {
				const extractedPath: string = match[0];
				let correspondingResourceFile: TAbstractFile | null = this.app.vault.getAbstractFileByPath(extractedPath)
				if (correspondingResourceFile)
					this.app.vault.delete(correspondingResourceFile)
			} else {
				console.log("Path not found");
			}
			this.activeFileContent = modifiedContent
		}
	}

	deleteFileHandler(file: TAbstractFile): void {
		if (this.markdownFile(file)) {
			let resourcePath: string = this.resourcePath(file)
			let resourceFolder: TAbstractFile | null = this.app.vault.getAbstractFileByPath(resourcePath)
			if (resourceFolder && resourceFolder instanceof TFolder) {
				this.app.vault.delete(resourceFolder, true)
				const parentFolder = resourceFolder.parent
				if (parentFolder)
					this.app.vault.delete(this.findNonEmptyParent(parentFolder, resourceFolder), true)
			}
		}
	}

	findNonEmptyParent(parent: TFolder, current: TFolder): TFolder {
		if (parent.children.filter(f => f instanceof TFolder && f != current).length == 0) {
			const parent: TFolder | null = current.parent
			if (parent) {
				const grandParent: TFolder | null = parent.parent
				if (grandParent)
					return this.findNonEmptyParent(grandParent, parent)
			}
		}
		return current
	}

	renameFileHandler(file: TAbstractFile, oldPath: string): void {
		this.newFileHandler(file)
		let resourceFolder: TAbstractFile | null = this.app.vault.getAbstractFileByPath(this.resourcePathBy(oldPath))
		if (resourceFolder) {
			this.app.vault.delete(resourceFolder, true)
		}
	}

	async onFileOpen(file: TFile | null) {
		if (file) {
			this.activeFileContent = await this.app.vault.read(file)
			this.activeFileName = file.name
		}
	}

	markdownFile(file: TAbstractFile): boolean {
		return file.path.endsWith('.md')
	}

	pngFile(file: TAbstractFile): boolean {
		return file.path.endsWith('.png')
	}

	resourcePath(file: TAbstractFile): string {
		return this.resourcePathBy(file.path)
	}

	resourcePathBy(filePath: string): string {
		let matched: RegExpMatchArray | null = filePath.match(this.filenamePattern)
		if (matched)
			return `resources/${matched[1].trim()}`;
		return `resources/${filePath}`
	}


	onunload() {
		this.unload()
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	appConfiguration() {
		// @ts-ignore
		let vaultPath = this.app.vault.adapter.basePath
		let configDir: string = this.app.vault.configDir;
		const absoluteConfigPath: string = `${vaultPath}/${configDir}/app.json`
		const fileContent = fs.readFileSync(absoluteConfigPath, 'utf-8');
		return JSON.parse(fileContent);
	}

	screenShotName() {
		const currentDate: Date = new Date();
		const year: number = currentDate.getFullYear();
		const month: string = String(currentDate.getMonth() + 1).padStart(2, "0");
		const day: string = String(currentDate.getDate()).padStart(2, "0");
		const hours: string = String(currentDate.getHours()).padStart(2, "0");
		const minutes: string = String(currentDate.getMinutes()).padStart(2, "0");
		const seconds: string = String(currentDate.getSeconds()).padStart(2, "0");

		return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}.png`;
	}
}
