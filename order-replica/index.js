import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

const ORDERS_PATH = path.join(__dirname, 'orders-data.csv')
const CATALOG_URL = process.env.CATALOG_URL || 'http://localhost:3001'
const REPLICA_URL = process.env.REPLICA_URL || 'http://localhost:3002'

//* POST /purchase/:id 
app.post('/purchase/:id', async (req, res) => {
  const id = req.params.id

  // Step 1: Get book info from catalog server
  let book
  try {
    const infoRes = await fetch(`${CATALOG_URL}/info/${id}`)
    book = await infoRes.json()
  } catch (err) {
    console.log(`[ORDER] ERROR — could not reach catalog server`)
    return res.status(500).json({ error: 'Could not reach catalog server' })
  }

  if (book.error) {
    console.log(`[ORDER] FAILED — book id=${id} not found`)
    return res.status(404).json({ error: 'Book not found' })
  }

  // Step 2: Check stock
  if (book.quantity <= 0) {
    console.log(`[ORDER] FAILED — "${book.title}" is out of stock`)
    return res.status(400).json({ error: 'Item out of stock' })
  }

  // Step 3: Decrement stock in catalog
  try {
    await fetch(`${CATALOG_URL}/update/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'quantity', value: -1 })
    })
  } catch (err) {
    console.log(`[ORDER] ERROR — could not update catalog`)
    return res.status(500).json({ error: 'Could not update catalog' })
  }
  // Step 4: Append to own orders-data.csv
  const orderId = Date.now()
  const timestamp = new Date().toISOString()
  const newRow = `\n${orderId},${book.id},${book.title},${timestamp}`
  fs.appendFileSync(ORDERS_PATH, newRow, 'utf8')

  // Step 5: Sync order to other replica
  try {
    await fetch(`${REPLICA_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        bookId: book.id,
        bookTitle: book.title,
        timestamp
      })
    })
    console.log(`[ORDER] SYNC sent to replica — order ${orderId}`)
  } catch (err) {
    console.log(`[ORDER] WARNING — could not reach order replica`)
  }

  // Step 6: Log and respond
  console.log(`[ORDER] bought book ${book.title}`)
  res.json({ message: 'Order placed successfully', book: book.title })
})

// Called by the other replica to mirror a new order row
app.post('/sync', (req, res) => {
  const { orderId, bookId, bookTitle, timestamp } = req.body
  const newRow = `\n${orderId},${bookId},${bookTitle},${timestamp}`
  fs.appendFileSync(ORDERS_PATH, newRow, 'utf8')
  console.log(`[ORDER] SYNC received — order ${orderId} "${bookTitle}"`)
  res.json({ message: 'Sync applied' })
})


//* listen 
const PORT = process.env.PORT || 3004

const server = app.listen(PORT, () => {
  console.log(`[ORDER] Server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[ORDER] Shutting down')
  server.close(() => {
    process.exit(0)
  })
})