// Start indexing
indexRecursively();

async function indexRecursively(lastIndexed = '') {
  try {
    const queryString = lastIndexed ? `?last_indexed=${lastIndexed}` : '';
    const url = `http://localhost:8787/api/v1/admin/index${queryString}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Response received:`, data);

    if (data.last_indexed === null) {
      console.log('Indexing completed');
      return;
    }

    // Recursive call with new last_indexed
    await indexRecursively(data.last_indexed);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

