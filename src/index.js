import './DOMShim'
import { BasePlugin, BaseComponent } from 'vatom-spaces-plugins'
import DOSEmulatorComponent from './DOSEmulatorComponent'
import GameboyEmulatorComponent from './GameboyEmulatorComponent'

/**
 * Emulator plugin
 */
export default class DOSEmulator extends BasePlugin {

    /** Plugin info */
    static id = "com.jjv360.emulators"
    static name = "Emulators"

    /** Called on load */
    onLoad() {

        // Register components
        DOSEmulatorComponent.register(this)
        GameboyEmulatorComponent.register(this)

    }

}
