/**
 * Create a DOM-like environment so the emulator libs don't freak out.
 */
function shimDOM() {

    // Window
    self.window = self

    // Document
    window.document = {
        addEventListener: () => null,
        removeEventListener: () => null,
    }

}

shimDOM()