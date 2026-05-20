import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPLICA_URL  = 'http://localhost:3001'   // points back to catalog replica 1
const FRONTEND_URL = 'http://localhost:3000'


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


//* PUT /update/:id
// PUT /update/:id  — invalidates cache, writes CSV, syncs to replica 1
app.put('/update/:id', async (req, res) => {
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

  // Step 1: Invalidate cache BEFORE writing
  try {
    await fetch(`${FRONTEND_URL}/cache/${id}`, { method: 'DELETE' })
    console.log(`[CATALOG-R2] CACHE INVALIDATE sent for id=${id}`)
  } catch (err) {
    console.log(`[CATALOG-R2] WARNING — could not reach frontend cache`)
  }

  // Step 2: Write to own CSV
  writeCatalog(books)
  console.log(`[CATALOG-R2] UPDATE id=${id} field=${field} value=${value}`)

  // Step 3: Sync to replica 1
  try {
    await fetch(`${REPLICA_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, field, value })
    })
    console.log(`[CATALOG-R2] SYNC sent to replica 1 for id=${id}`)
  } catch (err) {
    console.log(`[CATALOG-R2] WARNING — could not reach catalog replica 1`)
  }

  res.json({ message: 'Updated successfully' })
})


app.post('/sync', (req, res) => {
  const { id, field, value } = req.body

  const books = readCatalog()
  const book = books.find(b => b.id === parseInt(id))

  if (!book) {
    return res.status(404).json({ error: 'Book not found' })
  }

  if (field === 'quantity') {
    book.quantity += value
  } else if (field === 'price') {
    book.price = value
  }

  writeCatalog(books)
  console.log(`[CATALOG-R2] SYNC received — id=${id} field=${field} value=${value}`)
  res.json({ message: 'Sync applied' })
})


//* app.listen



const PORT = 3003
app.listen(PORT, () => {
  console.log(`[CATALOG] Server running on port ${PORT}`)
})