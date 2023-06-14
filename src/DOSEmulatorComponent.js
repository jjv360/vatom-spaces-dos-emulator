const originalOnMessage = self.onmessage
import { CommandInterface } from 'emulators'
import BaseEmulatorComponent from './BaseEmulatorComponent'

/**
 * This component emulates a DOS application and renders it onto a plane.
 */
export default class DOSEmulatorComponent extends BaseEmulatorComponent {

    /** @type {CommandInterface} Control Interface for DosBox */
    ci = null

    /** Register the component */
    static register(plugin) {

        // Register the component
        plugin.objects.registerComponent(DOSEmulatorComponent, {
            id: 'dos',
            name: 'Emulator - DOS',
            description: "Emulates a DOS application and renders it onto a plane.",
            settings: [
                ...this.defaultSettings,
            ]
        })

    }

    /** Start emulation */
    async start() {

        // Catch errors
        try {

            // Note: js-dos doesn't use imports correctly, it exposes itself on a global variable 'emulators'. For safety, ensure it exists here
            if (typeof emulators === 'undefined')
                throw new Error(`[DOSEmulator] js-dos not found.`)
            
            // Get path to js-dos WASM files
            emulators.pathPrefix = this.plugin.paths.absolute('js-dos') + '/'

            // Load the bundle
            let bundleURL = this.getField('bundle-url')
            console.debug(`[DOSEmulator] Downloading bundle: ${bundleURL}`)
            let result = await fetch(bundleURL)
            if (!result.ok) throw new Error(`[DOSEmulator] Failed to download bundle: ${result.status} ${result.statusText}`)
            let data = await result.arrayBuffer()

            // Load the emulator
            console.debug(`[DOSEmulator] Starting emulator...`)
            this.ci = await emulators.dosboxWorker(new Uint8Array(data), {})
            
            // Register handlers
            this.ci.events().onFrame(data => this.processVideoFrame(data))

            // Workaround: js-dos is replacing the Spaces listener, we can fix that in the main app but this workaround should work in the mean time
            if (self.onmessage != originalOnMessage)
                self.onmessage = originalOnMessage

        } catch (err) {

            // Log error
            console.warn(`[DOSEmulator] Error loading bundle: `, err.message)

        }

    }

    /** Stop the emulator */
    async stop() {

        // Shut down the emulator
        this.ci?.exit()
        this.ci = null

    }

    /** Called when we receive a video frame from the emulator */
    processVideoFrame(data) {

        // Convert incoming data to an ImageData object
        let data2 = new Uint8ClampedArray(320 * 200 * 4)
        for (let i = 0 ; i < 320 * 200 ; i++) {
            data2[i * 4 + 0] = data[i * 3 + 0]
            data2[i * 4 + 1] = data[i * 3 + 1]
            data2[i * 4 + 2] = data[i * 3 + 2]
            data2[i * 4 + 3] = 255
        }
        
        // Send it
        let imageData = new ImageData(data2, 320, 200)
        this.onVideoFrame(imageData)

    }

    /** @abstract On key down */
    onKeyDown(e) {

        // Skip if not loaded or if not in range
        if (!this.ci || !this.userDistanceInteract) 
            return

        // Get key code
        let codes = DOSKeyMap[e.code]
        if (!codes)
            return

        // Send it
        for (let c of codes) 
            this.ci?.sendKeyEvent(c, true)

    }

    /** @abstract On key up */
    onKeyUp(e) {

        // Skip if not loaded or if not in range
        if (!this.ci || !this.userDistanceInteract) 
            return

        // Get key code
        let codes = DOSKeyMap[e.code]
        if (!codes)
            return

        // Send it
        for (let c of codes) 
            this.ci?.sendKeyEvent(c, false)
    
    }

}

// Key mapping to DOS ... see https://github.com/js-dos/emulators/blob/main/src/keys.ts
const DOSKeyMap = {
    'KeyI': [265, 87],      // Forward (up, w)
    'KeyJ': [263],          // Left
    'KeyK': [264, 83],      // Backwards (down, s)
    'KeyL': [262],          // Right
    'KeyO': [257, 341, 89], // Select (enter, left control, y)
    'KeyP': [256],          // Back (escape)
}