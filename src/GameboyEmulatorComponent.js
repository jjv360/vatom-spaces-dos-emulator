import { BaseComponent } from 'vatom-spaces-plugins'
import { Gameboy } from "gameboy-emulator"

/**
 * This component emulates a Gameboy (non-color/advance) and renders it onto a plane.
 */
export default class GameboyEmulatorComponent extends BaseComponent {

    /** Register the component */
    static register(plugin) {

        // Register the component
        plugin.objects.registerComponent(this, {
            id: 'gameboy',
            name: 'Emulator - GameBoy',
            description: "Emulates a Gameboy and renders it onto a plane.",
            settings: [
                { id: 'bundle-url', name: 'Bundle URL', type: 'text', help: `The URL to a .gb file.` }
            ]
        })

    }

    /** Called on load */
    onLoad() {

        // Start emulation
        this.start()

    }

    /** Start emulation */
    async start() {

        // Get bundle URL, stop if not found
        let bundleURL = this.getField('bundle-url')
        if (!bundleURL)
            return

        // Stop if already started
        if (this._started) return
        this._started = true

        // Catch errors
        try {

            // DOM shim
            self.document = {}

            // Load ROM
            console.debug(`[GameboyEmulator] Downloading rom: ${bundleURL}`)
            let result = await fetch(bundleURL)
            if (!result.ok) throw new Error(`[GameboyEmulator] Failed to download rom: ${result.status} ${result.statusText}`)
            let rom = await result.arrayBuffer()

            // Create it
            this.gameboy = new Gameboy()
            this.gameboy.loadGame(rom)
            this.gameboy.onFrameFinished(frame => this.onFrame(frame))
            this.gameboy.run()

        } catch (err) {

            // Log error
            console.warn(`[DOSEmulator] Error loading bundle: `, err)

        }

    }

    /** Called when a frame is received */
    onFrame(frame) {

        console.log('frame', frame)

    }

}