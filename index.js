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

//fixes the structure of an array of items by automatically creating
//new children for items that start with whitespace
const fixStructure = items => {
  //if no items were given return immediately
  if (!(typeof items === "object" && items && items.length)) {
    return []
  }

  //a fake first normal item in case the first item of this list starts with a space
  const fakeFirstItem = {
    title: "PLACEHOLDER",
    items: []
  }

  //keep track of the last item that didn't start with a space
  let latestNormalItem = fakeFirstItem

  //iterate the items and look for items that start with a space
  items.forEach(item => {
    //if this item starts with a space
    if (item.title.startsWith(" ")) {
      //remove this one space from the title since we fixed it now
      item.title = item.title.substring(1)

      //mark it for removal from this list
      item.relocated = true

      //add it to the current last normal item as a child
      latestNormalItem.items = latestNormalItem.items || []
      latestNormalItem.items.push(item)
    } else {
      //doesn't start with a space, use as the new last normal item
      latestNormalItem = item
    }
  })

  //remove the relocated items from the list
  items = items.filter(item => {
    //save the relocated status
    const { relocated } = item

    //delete the property so that deeper calls of fixStructure don't remove this item
    delete item.relocated

    //return the status of the flag for filtering
    return !relocated
  })

  //if the fake first item has received items, add it to the beginning of the list
  if (fakeFirstItem.items.length) {
    items.unshift(fakeFirstItem)
  }

  //fix the structure of all remaining children
  items.forEach(item => (item.items = fixStructure(item.items)))

  //return the filtered and fixed items
  return items
}

//run the processing in a async function
;(async () => {
  //get the path of the document from the command line
  const inFileName = process.argv[2] || "input.pdf"
  const inputPath = path.join(__dirname, inFileName)

  //check if the input is a directory
  const isDirectory = (await fs.lstat(inputPath)).isDirectory()

  //make the output path with the input file name
  const outFileName = `${inFileName}${isDirectory ? "_dir" : ""}_out.txt`
  const outputPath = path.join(__dirname, outFileName)

  //array of the paths to process
  const processPaths = isDirectory
    ? //all the pdf files in the directory need to be processed
      (await fs.readdir(inputPath)).filter(file => file.endsWith(".pdf"))
    : //we only need to process the one input file if a single file was given
      [inputPath]

  //get the outline for all given paths, get them all at the same time
  let outline = await Promise.all(
    processPaths.map(async file => {
      //load and parse the pdf document,
      //we need to await on the promise given in .promise
      const pdf = await pdfjs.getDocument(
        //load the file from the specified path
        new Uint8Array(await fs.readFile(path.join(inputPath, file)))
      ).promise

      //get the outline
      let outline = await pdf.getOutline()

      //if there is only one root item and stripping is enabled
      if (stripSingleRootItem && outline && outline.length === 1) {
        //strip the outline to only be the items of the root item
        outline = outline[0].items || []
      }

      //return a fake item for this file
      return {
        //parse a nice title from the file name
        title: file.match(/(.+)\.pdf/)[1].trim(),
        items: outline
      }
    })
  )

  //preprocess the outline structure
  outline = fixStructure(outline)

  //process the outline items into a nice plaintext outline
  const formattedOutline = processItems(outline)

  //output on the console
  console.log(formattedOutline)

  //and write to an output file
  await fs.writeFile(outputPath, formattedOutline)
})()
