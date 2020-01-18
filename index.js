//libraries
const pdfjs = require("pdfjs-dist")
const fs = require("fs-extra")
const path = require("path")

//if we are numbering or only indenting the items
const doNumbering = false

//what string to use for indentation
const indentStep = "_"

//separator between the path prefix and the line content
const lineInfix = ""

//enable stripping of the root item if it's the only one
const stripSingleRootItem = true

//a function that recursively processes a given array of items
const processItems = (items, path = "") => {
  //return joined lines for each item
  return (
    items
      .map((item, index) => {
        //generate the line for only this item,
        //default to a placeholder if there is no title
        let itemLine = path + lineInfix + (item.title || "NO TITLE")

        //append processed child items if there are any
        if (item.items && item.items.length) {
          //add a newline before the child entries to separate
          //and increment the depth in the recursive call
          itemLine +=
            "\n" +
            processItems(
              item.items,

              //add a numbering or the indent step to the path for the children
              path + (doNumbering ? index + 1 + "." : indentStep)
            )
        }

        //return the line
        return itemLine
      })

      //join all the child lines together
      .join("\n")
  )
}

//run the processing in a async function
;(async () => {
  //get the path of the document from the command line
  const inFileName = process.argv[2] || "input.pdf"
  const inputPath = path.join(__dirname, inFileName)
  const outFileName = `${inFileName}_out.txt`
  const outputPath = path.join(__dirname, outFileName)

  //load and parse the pdf document,
  //we need to await on the promise given in .promise
  const pdf = await pdfjs.getDocument(
    //load the file from the specified path
    new Uint8Array(await fs.readFile(inputPath))
  ).promise

  //get the outline
  let outline = await pdf.getOutline()

  //if there is only one root item and stripping is enabled
  if (stripSingleRootItem && outline.length === 1) {
    //strip the outline to only be the items of the root item
    outline = outline[0].items || []
  }

  //process the outline items into a nice plaintext outline
  const formattedOutline = processItems(outline)

  //output on the console
  console.log(formattedOutline)

  //and write to an output file
  await fs.writeFile(outputPath, formattedOutline)
})()
