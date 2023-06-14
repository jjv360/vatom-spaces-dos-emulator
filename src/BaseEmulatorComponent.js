import { BaseComponent } from 'vatom-spaces-plugins'
import { convertPanelHTML } from './Utilities'

/**
 * Base emulator component, handles rendering audio and video etc.
 */
export default class BaseEmulatorComponent extends BaseComponent {

    /** Default component settings */
    static defaultSettings = [
        { id: 'bundle-url', name: 'Bundle URL', type: 'text', help: `The URL to a jsdos bundle file.` },
        { id: 'load-distance', name: 'Load Distance', type: 'number', help: `The distance from the user at which the emulator will load.`, default: 10 },
        { id: 'interact-distance', name: 'Interact Distance', type: 'number', help: `The distance from the user at which the emulator can be interacted with.`, default: 3 },
    ]

    /** True if the user is close enough to load the emulator */
    userDistanceLoad = false

    /** True if the user is close enough to interact */
    userDistanceInteract = false

    /** Called on load */
    async onLoad() {

        // Add keyboard listener
        this.onKeyDown = this.onKeyDown.bind(this)
        this.onKeyUp = this.onKeyUp.bind(this)
        this.plugin.hooks.addHandler('controls.key.down', this.onKeyDown)
        this.plugin.hooks.addHandler('controls.key.up', this.onKeyUp)

        // Create canvas texture
        this.texture = await this.plugin.textures.create({ width: 320, height: 200 })
        this.textureCtx = this.texture.getContext('2d')
        this.textureCtx.fillStyle = 'red'

        // Replace the object's texture with our own
        this.plugin.objects.update(this.objectID, { texture: this.texture.id }, true)

        // Hack: For some reason replacing an existing texture doesn't work unless we change some material properties,
        // so just change the color here
        this.plugin.objects.update(this.objectID, { color: '#FeFFFF' }, true)
        await new Promise(c => setTimeout(c, 100))
        this.plugin.objects.update(this.objectID, { color: '#FFFFFF' }, true)

        // Start timer to check state
        this.timer = setInterval(() => this.checkStatus(), 500)

    }

    /** Called on unload */
    onUnload() {

        // Stop timer
        clearInterval(this.timer)

        // Remove keyboard listener
        this.plugin.hooks.removeHandler('controls.key.down', this.onKeyDown)
        this.plugin.hooks.removeHandler('controls.key.up', this.onKeyUp)

    }

    /** Called when anything changes */
    async checkStatus() {

        // Don't run in parallel
        if (this._checking) return
        this._checking = true

        // Catch errors
        try {

            // Check parts
            await this.checkDistances()
            await this.checkGame()
            await this.checkControls()

        } finally {

            // No longer running
            this._checking = false

        }
    }

    /** Check distances */
    async checkDistances() {

        // Get distances
        let loadDistance = parseFloat(this.getField('load-distance')) || 10
        let interactDistance = parseFloat(this.getField('interact-distance')) || 3

        // Check if the user is nearby
        let x = this.fields.x || 0
        let y = this.fields.height || 0
        let z = this.fields.y || 0
        let userPos = await this.plugin.user.getPosition()
        let distance = Math.sqrt((x - userPos.x) ** 2 + (y - userPos.y) ** 2 + (z - userPos.z) ** 2)
        this.userDistanceLoad = distance < loadDistance
        this.userDistanceInteract = distance < interactDistance && this._started

    }

    /** Check if the game should be reloaded */
    async checkGame() {

        // Check if we can load
        let bundleURL = this.getField('bundle-url')
        let canLoad = bundleURL && this.userDistanceLoad

        // Check what to do
        if (canLoad && !this._started) {

            // Start emulator
            console.debug(`[Emulator] Starting emulator`)
            this.currentBundle = bundleURL
            await this.start()
            this._started = true

        } else if (!canLoad && this._started) {

            // Clear canvas
            console.debug(`[Emulator] Stopping emulator`)
            this.textureCtx.fillStyle = 'black'
            this.textureCtx.fillRect(0, 0, 320, 200)
            this.texture.update()

            // Stop emulator
            this._started = false
            await this.stop()

        } else if (this._started && bundleURL != this.currentBundle) {

            // Reload emulator
            console.debug(`[Emulator] Reloading emulator`)
            this._started = false
            await this.stop()

        }

    }

    /** 
     * Process incoming video frame 
     * 
     * @param {ImageData} imageData The video frame data
     */
    onVideoFrame(imageData) {

        // Stop if no texture
        if (!this.texture || !this.textureCtx || !this._started)
            return

        // Update texture
        this.textureCtx.putImageData(imageData, 0, 0)
        this.texture.update()

    }

    /** Check if the controls overlay should be shown */
    async checkControls() {

        // Check if the controls should be shown
        if (this.controlsOverlayID && !this.userDistanceInteract) {
            
            // Hide the controls
            this.plugin.menus.unregister(this.controlsOverlayID)
            this.controlsOverlayID = null

        } else if (!this.controlsOverlayID && this.userDistanceInteract) {

            // Show controls
            this.controlsOverlayID = await this.plugin.menus.register({
                section: 'overlay-top',
                panel: {
                    pointerEvents: 'none',
                    iframeURL: convertPanelHTML(`
                        <img style='position: absolute; bottom: 50px; left: calc(50% - 100px); width: 200px; height: 200px; opacity: 0.5; ' src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHg9Ijc1LjUiIHk9Ijc1LjUiIHdpZHRoPSI0OSIgaGVpZ2h0PSI0OSIgcng9IjExLjUiIHN0cm9rZT0id2hpdGUiLz4KPHJlY3QgeD0iNzUuNSIgeT0iNzUuNSIgd2lkdGg9IjQ5IiBoZWlnaHQ9IjQ5IiByeD0iMTEuNSIgc3Ryb2tlPSJ3aGl0ZSIvPgo8cmVjdCB4PSI3NS41IiB5PSI3NS41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9IjcuNSIgeT0iNy41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9IjcuNSIgeT0iNy41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9IjcuNSIgeT0iNy41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9IjE0NC41IiB5PSI3LjUiIHdpZHRoPSI0OSIgaGVpZ2h0PSI0OSIgcng9IjExLjUiIHN0cm9rZT0id2hpdGUiLz4KPHJlY3QgeD0iMTQ0LjUiIHk9IjcuNSIgd2lkdGg9IjQ5IiBoZWlnaHQ9IjQ5IiByeD0iMTEuNSIgc3Ryb2tlPSJ3aGl0ZSIvPgo8cmVjdCB4PSIxNDQuNSIgeT0iNy41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9Ijc1LjUiIHk9IjEzNC41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9Ijc1LjUiIHk9IjEzNC41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9Ijc1LjUiIHk9IjEzNC41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9IjE4LjUiIHk9IjEzNC41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9IjE4LjUiIHk9IjEzNC41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9IjE4LjUiIHk9IjEzNC41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxyZWN0IHg9IjEzMi41IiB5PSIxMzQuNSIgd2lkdGg9IjQ5IiBoZWlnaHQ9IjQ5IiByeD0iMTEuNSIgc3Ryb2tlPSJ3aGl0ZSIvPgo8cmVjdCB4PSIxMzIuNSIgeT0iMTM0LjUiIHdpZHRoPSI0OSIgaGVpZ2h0PSI0OSIgcng9IjExLjUiIHN0cm9rZT0id2hpdGUiLz4KPHJlY3QgeD0iMTMyLjUiIHk9IjEzNC41IiB3aWR0aD0iNDkiIGhlaWdodD0iNDkiIHJ4PSIxMS41IiBzdHJva2U9IndoaXRlIi8+CjxwYXRoIGQ9Ik05My4yNCAxMTNWMTEwLjY0SDk4LjE2VjkwLjQ0SDkzLjUyVjg4LjA4SDEwNS44OFY5MC40NEgxMDAuOTZWMTEwLjY4SDEwNi4xMlYxMTNIOTMuMjRaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMzIgNDUuNDRDMzAuMTA2NyA0NS40NCAyOC40OTMzIDQ0Ljk0NjcgMjcuMTYgNDMuOTZDMjUuODI2NyA0Mi45NzMzIDI0LjgxMzMgNDEuNTMzMyAyNC4xMiAzOS42NEMyMy40MjY3IDM3LjcyIDIzLjA4IDM1LjQgMjMuMDggMzIuNjhDMjMuMDggMzAuMDQgMjMuNDI2NyAyNy43NzMzIDI0LjEyIDI1Ljg4QzI0LjgxMzMgMjMuOTYgMjUuODI2NyAyMi40OTMzIDI3LjE2IDIxLjQ4QzI4LjQ5MzMgMjAuNDQgMzAuMTA2NyAxOS45MiAzMiAxOS45MkMzMy45MiAxOS45MiAzNS41MzMzIDIwLjQ0IDM2Ljg0IDIxLjQ4QzM4LjE3MzMgMjIuNDkzMyAzOS4xODY3IDIzLjk2IDM5Ljg4IDI1Ljg4QzQwLjU3MzMgMjcuNzczMyA0MC45MiAzMC4wNCA0MC45MiAzMi42OEM0MC45MiAzNS40IDQwLjU3MzMgMzcuNzIgMzkuODggMzkuNjRDMzkuMTg2NyA0MS41MzMzIDM4LjE3MzMgNDIuOTczMyAzNi44NCA0My45NkMzNS41MzMzIDQ0Ljk0NjcgMzMuOTIgNDUuNDQgMzIgNDUuNDRaTTMyIDQzQzMzLjI4IDQzIDM0LjM2IDQyLjYgMzUuMjQgNDEuOEMzNi4xNDY3IDQxIDM2Ljg0IDM5Ljg0IDM3LjMyIDM4LjMyQzM3LjggMzYuNzczMyAzOC4wNCAzNC44OTMzIDM4LjA0IDMyLjY4QzM4LjA0IDMwLjU3MzMgMzcuOCAyOC43NiAzNy4zMiAyNy4yNEMzNi44NCAyNS42OTMzIDM2LjE0NjcgMjQuNDkzMyAzNS4yNCAyMy42NEMzNC4zNiAyMi43ODY3IDMzLjI4IDIyLjM2IDMyIDIyLjM2QzMwLjc0NjcgMjIuMzYgMjkuNjY2NyAyMi43ODY3IDI4Ljc2IDIzLjY0QzI3Ljg1MzMgMjQuNDkzMyAyNy4xNiAyNS42OTMzIDI2LjY4IDI3LjI0QzI2LjIgMjguNzYgMjUuOTYgMzAuNTczMyAyNS45NiAzMi42OEMyNS45NiAzNC44OTMzIDI2LjIgMzYuNzczMyAyNi42OCAzOC4zMkMyNy4xNiAzOS44NCAyNy44NTMzIDQxIDI4Ljc2IDQxLjhDMjkuNjY2NyA0Mi42IDMwLjc0NjcgNDMgMzIgNDNaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTYxLjM2IDQ1VjIwLjA4SDE2OS4zNkMxNzEuMjI3IDIwLjA4IDE3Mi43MzMgMjAuNCAxNzMuODggMjEuMDRDMTc1LjAyNyAyMS42OCAxNzUuODY3IDIyLjUzMzMgMTc2LjQgMjMuNkMxNzYuOTYgMjQuNjQgMTc3LjI0IDI1LjgxMzMgMTc3LjI0IDI3LjEyQzE3Ny4yNCAyOC4wOCAxNzcuMDkzIDI4Ljk3MzMgMTc2LjggMjkuOEMxNzYuNTA3IDMwLjYyNjcgMTc2LjA0IDMxLjM2IDE3NS40IDMyQzE3NC43ODcgMzIuNjQgMTc0IDMzLjEzMzMgMTczLjA0IDMzLjQ4QzE3Mi4wOCAzMy44MjY3IDE3MC45MiAzNCAxNjkuNTYgMzRIMTY0LjI0VjQ1SDE2MS4zNlpNMTY0LjI0IDMxLjUySDE2OS4yNEMxNzAuNDY3IDMxLjUyIDE3MS40NTMgMzEuMzQ2NyAxNzIuMiAzMUMxNzIuOTQ3IDMwLjYyNjcgMTczLjQ5MyAzMC4xMiAxNzMuODQgMjkuNDhDMTc0LjE4NyAyOC44MTMzIDE3NC4zNiAyOC4wNTMzIDE3NC4zNiAyNy4yQzE3NC4zNiAyNi4zNzMzIDE3NC4xODcgMjUuNjI2NyAxNzMuODQgMjQuOTZDMTczLjQ5MyAyNC4yOTMzIDE3Mi45NDcgMjMuNzYgMTcyLjIgMjMuMzZDMTcxLjQ1MyAyMi45MzMzIDE3MC40OCAyMi43MiAxNjkuMjggMjIuNzJIMTY0LjI0VjMxLjUyWiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTk2LjY0IDE1OS41Mkw5NC42OCAxNjEuNjhWMTcySDkxLjY4VjE0Ny4wOEg5NC42NEg5NS4wNFYxNDcuMzZDOTQuODggMTQ3LjUyIDk0Ljc3MzMgMTQ3LjY5MyA5NC43MiAxNDcuODhDOTQuNjkzMyAxNDguMDY3IDk0LjY4IDE0OC4zODcgOTQuNjggMTQ4Ljg0VjE1OC41NkwxMDUuMDggMTQ2Ljg4QzEwNS4yNCAxNDYuOTA3IDEwNS40IDE0Ni45MzMgMTA1LjU2IDE0Ni45NkMxMDUuNzIgMTQ2Ljk4NyAxMDUuODggMTQ3LjAxMyAxMDYuMDQgMTQ3LjA0QzEwNi4yMjcgMTQ3LjA0IDEwNi40MTMgMTQ3LjA1MyAxMDYuNiAxNDcuMDhDMTA2Ljc4NyAxNDcuMDggMTA2Ljk3MyAxNDcuMDggMTA3LjE2IDE0Ny4wOEgxMDguMkw5OC43NiAxNTcuODRMMTA4Ljg0IDE3MkwxMDUuMjQgMTcyLjE2TDk2LjY0IDE1OS41MloiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00MC44NCAxNzIuNDRDMzkuNjY2NyAxNzIuNDQgMzguNTg2NyAxNzIuMjEzIDM3LjYgMTcxLjc2QzM2LjYxMzMgMTcxLjI4IDM1LjczMzMgMTcwLjU4NyAzNC45NiAxNjkuNjhMMzYuNTYgMTY3LjY4TDM2Ljg0IDE2Ny4zNkwzNy4wNCAxNjcuNTJDMzcuMDY2NyAxNjcuNzYgMzcuMTIgMTY3Ljk3MyAzNy4yIDE2OC4xNkMzNy4zMDY3IDE2OC4zNDcgMzcuNTMzMyAxNjguNTg3IDM3Ljg4IDE2OC44OEMzOC4zMzMzIDE2OS4yMjcgMzguNzg2NyAxNjkuNDkzIDM5LjI0IDE2OS42OEMzOS43MiAxNjkuODY3IDQwLjI1MzMgMTY5Ljk2IDQwLjg0IDE2OS45NkM0MS43NDY3IDE2OS45NiA0Mi40OCAxNjkuNzYgNDMuMDQgMTY5LjM2QzQzLjYgMTY4Ljk2IDQ0LjAxMzMgMTY4LjMwNyA0NC4yOCAxNjcuNEM0NC41NDY3IDE2Ni40NjcgNDQuNjggMTY1LjIyNyA0NC42OCAxNjMuNjhWMTQ5LjQ0SDM5Ljg4VjE0Ny4wOEg1MS4yOFYxNDkuNDRINDcuNDRWMTYzLjY0QzQ3LjQ5MzMgMTY1LjI0IDQ3LjM0NjcgMTY2LjYgNDcgMTY3LjcyQzQ2LjY1MzMgMTY4Ljg0IDQ2LjE2IDE2OS43NiA0NS41MiAxNzAuNDhDNDQuODggMTcxLjE3MyA0NC4xNiAxNzEuNjggNDMuMzYgMTcyQzQyLjU2IDE3Mi4yOTMgNDEuNzIgMTcyLjQ0IDQwLjg0IDE3Mi40NFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xNDkuNjQgMTQ3LjA4SDE1Mi41MkgxNTIuOTJWMTQ3LjM2QzE1Mi43NiAxNDcuNTIgMTUyLjY1MyAxNDcuNjkzIDE1Mi42IDE0Ny44OEMxNTIuNTczIDE0OC4wNjcgMTUyLjU2IDE0OC4zODcgMTUyLjU2IDE0OC44NFYxNjkuNkgxNjQuNTZWMTcySDE0OS42NFYxNDcuMDhaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K" />
                    `)
                }
            })

        }

    }

    /** @abstract On key down */
    onKeyDown(e) {}

    /** @abstract On key up */
    onKeyUp(e) {}

}