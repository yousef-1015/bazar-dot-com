import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

const CSV_PATH = path.join(__dirname, 'catalog-data.csv')

//*********** */

function readCatalog() {
  const lines = fs.readFileSync(CSV_PATH, 'utf8').trim().split('\n')
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const values = line.split(',')
    return {
      id:       parseInt(values[0]),
      title:    values[1],
      topic:    values[2],
      price:    parseFloat(values[3]),
      quantity: parseInt(values[4])
    }
  })
}

function writeCatalog(books) {
  const header = 'id,title,topic,price,quantity'
  const rows = books.map(b => `${b.id},${b.title},${b.topic},${b.price},${b.quantity}`)
  fs.writeFileSync(CSV_PATH, [header, ...rows].join('\n'), 'utf8')
}

// * GET /search/:topic/
app.get('/search/:topic', (req, res) => {
  const topic = req.params.topic.toLowerCase()
  const books = readCatalog()
  const results = books
    .filter(book => book.topic.toLowerCase() === topic)
    .map(book => ({ id: book.id, title: book.title }))

  console.log(`[CATALOG] SEARCH topic="${topic}" → ${results.length} result(s)`)
  res.json(results)
})

//*Block 4 — GET /info/:id:


app.get('/info/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const books = readCatalog()
  const book = books.find(b => b.id === id)

  if (!book) {
    console.log(`[CATALOG] INFO id=${id} → not found`)
    return res.status(404).json({ error: 'Book not found' })
  }

  console.log(`[CATALOG] INFO id=${id} → "${book.title}"`)
  res.json(book)
})


//* Block 5 — PUT /update/:id
app.put('/update/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const { field, value } = req.body

  const books = readCatalog()
  const book = books.find(b => b.id === id)

  if (!book) {
    return res.status(404).json({ error: 'Book not found' })
  }

  if (field === 'quantity') {
    book.quantity += value
  } else if (field === 'price') {
    book.price = value
  } else {
    return res.status(400).json({ error: 'Invalid field' })
  }

  writeCatalog(books)
  console.log(`[CATALOG] UPDATE id=${id} field=${field} value=${value}`)
  res.json({ message: 'Updated successfully' })
})



//* app.listen



const PORT = 3003
app.listen(PORT, () => {
  console.log(`[CATALOG] Server running on port ${PORT}`)
})