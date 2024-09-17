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
// 
// 
// 
// mongo
const simulatedData = [
    { time: 1725594300000, open: 25093.7, high: 25120.4, low: 25088.4, close: 25113.95, volume: 0 },
    { time: 1725594305000, open: 25120.65, high: 25131.65, low: 25118.15, close: 25126.1, volume: 0 },
    { time: 1725594310000, open: 25121.85, high: 25121.85, low: 25114.2, close: 25117.85, volume: 0 },
    { time: 1725594315000, open: 25115.6, high: 25118.2, low: 25111.25, close: 25114.4, volume: 0 },
    { time: 1725594320000, open: 25117.6, high: 25117.6, low: 25108.75, close: 25108.75, volume: 0 },
    { time: 1725594325000, open: 25108.5, high: 25122.85, low: 25108.25, close: 25122.85, volume: 0 },
    { time: 1725594330000, open: 25121.4, high: 25125.3, low: 25118.0, close: 25118.0, volume: 0 },
    { time: 1725594335000, open: 25118.2, high: 25118.65, low: 25116.7, close: 25118.35, volume: 0 }
];

const dataArrays = {
    '5S': [],
    '1': [],
    '3': [],
    '5': [],
    '15': [],
    '30': [],
    '60': [],
    '120': [],
    '240': [],
    '1D': [],
    '1W': [],
    '1M': []
};

function* streamData() {
    for (const data of simulatedData) {
        yield data;
    }
}

function aggregateData(data, timeframe) {
    const aggregated = [];
    let currentBucket = null;
    const timeframeMs = getTimeframeMs(timeframe);

    for (let row of data) {
        const bucketTime = Math.floor(row.time / timeframeMs) * timeframeMs;

        if (!currentBucket || currentBucket.time !== bucketTime) {
            if (currentBucket) {
                aggregated.push(currentBucket);
            }
            currentBucket = {
                time: bucketTime,
                open: row.open,
                high: row.high,
                low: row.low,
                close: row.close,
                volume: row.volume
            };
        } else {
            currentBucket.high = Math.max(currentBucket.high, row.high);
            currentBucket.low = Math.min(currentBucket.low, row.low);
            currentBucket.close = row.close;
            currentBucket.volume += row.volume;
        }
    }

    if (currentBucket) {
        aggregated.push(currentBucket);
    }

    return aggregated;
}

function getTimeframeMs(timeframe) {
    const unit = timeframe.slice(-1);
    const value = parseInt(timeframe);
    switch (unit) {
        case 'S': return value * 1000;
        case 'D': return value * 24 * 60 * 60 * 1000;
        case 'W': return value * 7 * 24 * 60 * 60 * 1000;
        case 'M': return value * 30 * 24 * 60 * 60 * 1000;
        default: return value * 60 * 1000; // Assume minutes if no unit specified
    }
}

// Initialize dataArrays with aggregated data
function initializeDataArrays() {
    for (let timeframe in dataArrays) {
        dataArrays[timeframe] = aggregateData(simulatedData, timeframe);
    }
    console.log("Initialized dataArrays:", JSON.stringify(dataArrays, null, 2));
}

// Adjust timestamps to be relative to current time
function adjustTimestamps() {
    const now = Date.now();
    const firstDataTime = simulatedData[0].time;
    const timeDiff = now - firstDataTime;

    simulatedData.forEach(data => {
        data.time += timeDiff;
    });

    console.log("Adjusted timestamps. First data point:", new Date(simulatedData[0].time).toISOString());
}

// Call these functions to prepare the data
adjustTimestamps();
initializeDataArrays();

module.exports = { streamData, aggregateData, dataArrays, initializeDataArrays, adjustTimestamps };