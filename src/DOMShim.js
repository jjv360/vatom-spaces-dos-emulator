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

    // Shim for using WebWorkers from within WebWorkers, when the new URL is on a different domain
    // What the heck even is this... What "security" does this provide, browser makers?
    self.originalWorker = Worker
    self.Worker = class extends originalWorker {
        constructor(url) {

            // Create code to download and eval the code
            let code = `importScripts('${url}')`

            // Convert to data URI and run it
            let dataURI = 'data:text/javascript;base64,' + btoa(code)
            super(dataURI)

        }
    }

}

shimDOM()