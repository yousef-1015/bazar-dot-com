import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch' 
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

const CSV_PATH = path.join(__dirname, 'catalog-data.csv')

const REPLICA_URL = process.env.REPLICA_URL || 'http://localhost:3003'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

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


//*  PUT /update/:id
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
  //* Tells the frontend to delete its cached copy of this book
  try {
    await fetch(`${FRONTEND_URL}/cache/${id}`, { method: 'DELETE' })
    console.log(`[CATALOG] CACHE INVALIDATE sent for id=${id}`)
  } catch (err) {
    console.log(`[CATALOG] WARNING — could not reach frontend cache`)
  }

  // Step 2: Write to own CSV
  writeCatalog(books)
  console.log(`[CATALOG] UPDATE id=${id} field=${field} value=${value}`)

  // Step 3: Sync to other replica
  try {
    await fetch(`${REPLICA_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, field, value }) //This converts a JavaScript object into a JSON string so it can be sent over the network:

    })
    console.log(`[CATALOG] SYNC sent to replica for id=${id}`)
  } catch (err) {
    console.log(`[CATALOG] WARNING — could not reach catalog replica`)
  }

  res.json({ message: 'Updated successfully' })
})


// Called by the other replica to mirror a write — does NOT sync back (no loop)
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
  console.log(`[CATALOG] SYNC received — id=${id} field=${field} value=${value}`)
  res.json({ message: 'Sync applied' })
})



//* app.listen

const PORT = 3001
app.listen(PORT, () => {
  console.log(`[CATALOG] Server running on port ${PORT}`)
})