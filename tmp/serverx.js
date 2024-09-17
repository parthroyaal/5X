const express = require('express');
const cors = require('cors');
const { streamData, aggregateData, dataArrays, initializeDataArrays, adjustTimestamps } = require('./dataProcessor');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));

// Initialize and adjust data when the server starts
adjustTimestamps();
initializeDataArrays();

// Endpoint for SSE
app.get('/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const dataStream = streamData();
    
    const streamInterval = setInterval(async () => {
        const { value: newData, done } = await dataStream.next();
        if (done) {
            clearInterval(streamInterval);
            res.write('event: close\ndata: Stream ended\n\n');
            return res.end();
        }
        
        // Update dataArrays with new data
        for (let timeframe in dataArrays) {
            dataArrays[timeframe] = aggregateData([...dataArrays[timeframe], newData], timeframe);
        }
        
        console.log("New data streamed:", new Date(newData.time).toISOString(), newData);
        res.write(`data: ${JSON.stringify(newData)}\n\n`);
    }, 5000);

    req.on('close', () => clearInterval(streamInterval));
});

// Endpoint for getBars
app.get('/bars', (req, res) => {
    const { resolution, from, to } = req.query;
    const fromTime = parseInt(from) * 1000;
    const toTime = parseInt(to) * 1000;

    console.log(`Received request for bars: resolution=${resolution}, from=${new Date(fromTime).toISOString()}, to=${new Date(toTime).toISOString()}`);

    const bars = dataArrays[resolution].filter(bar => {
        return bar.time >= fromTime && bar.time <= toTime;
    });

    console.log(`Returning ${bars.length} bars for resolution ${resolution}`);
    res.json(bars);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});