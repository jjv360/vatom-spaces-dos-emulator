import { BaseComponent } from 'vatom-spaces-plugins'

/**
 * This component emulates a DOS application and renders it onto a plane.
 */
export default class DOSEmulatorComponent extends BaseComponent {

    /** Register the component */
    static register(plugin) {

        // Register the component
        plugin.objects.registerComponent(DOSEmulatorComponent, {
            id: 'dos',
            name: 'Emulator - DOS',
            description: "Emulates a DOS application and renders it onto a plane.",
            settings: [
                { id: 'bundle-url', name: 'Bundle URL', type: 'text', help: `The URL to a jsdos bundle file.` }
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

            // Load the emulator lib
            if (!DOSEmulatorComponent.hasLoadedLib) {
                DOSEmulatorComponent.hasLoadedLib = true

                // Load the library
                console.debug(`[DOSEmulator] Loading js-dos...`)
                importScripts(this.plugin.paths.absolute('js-dos/emulators.js'))

                // Specify path to the rest of it's files
                emulators.pathPrefix = this.plugin.paths.absolute('js-dos') + '/'

            }

            // Check it loaded correctly
            if (typeof emulators === 'undefined')
                throw new Error(`[DOSEmulator] js-dos not found.`)

            // Load the bundle
            console.debug(`[DOSEmulator] Downloading bundle: ${bundleURL}`)
            let result = await fetch(bundleURL)
            if (!result.ok) throw new Error(`[DOSEmulator] Failed to download bundle: ${result.status} ${result.statusText}`)
            let data = await result.arrayBuffer()

            // Load the emulator
            let ci = await emulators.dosboxDirect(new Uint8Array(data), {})
            console.log('ci', ci)

        } catch (err) {

            // Log error
            console.warn(`[DOSEmulator] Error loading bundle: `, err)

        }

    }

}