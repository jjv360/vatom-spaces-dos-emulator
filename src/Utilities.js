import base64 from 'base-64'

/** Convert HTML to a data URI usable as a panel */
export function convertPanelHTML(html) {

    // Add html wrapper
    html = `<!DOCTYPE html>
    <html>
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
                html, head {
                    overflow: hidden;
                    width: 100%; height: 100%; 
                    margin: 0px;
                    padding: 0px;
                    cursor: default;
                    font-family: Inter, Helvetica Neue, Helvetica, Arial; 
                }
            </style>
        </head>
        <body>
            ${html.trim()}
        </body>
    </html>`

    // Convert to data uri
    return 'data:text/html;base64,' + base64.encode(html)

}