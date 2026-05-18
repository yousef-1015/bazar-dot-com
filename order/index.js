import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

const ORDERS_PATH = path.join(__dirname, 'orders.csv')
const CATALOG_URL = 'http://localhost:3001'


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

  // Step 4: Append to orders.csv
  const orderId = Date.now()
  const timestamp = new Date().toISOString()
  const newRow = `\n${orderId},${book.id},${book.title},${timestamp}`
  fs.appendFileSync(ORDERS_PATH, newRow, 'utf8')

  // Step 5: Log and respond
  console.log(`[ORDER] bought book ${book.title}`)
  res.json({ message: 'Order placed successfully', book: book.title })
})






//* listen 
const PORT = 3002
app.listen(PORT, () => {
  console.log(`[ORDER] Server running on port ${PORT}`)
})