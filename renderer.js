// ========== API CONFIGURATION ==========
const STOP_LIST_API = 'https://data.etabus.gov.hk/v1/transport/kmb/stop';
const ETA_API_BASE = 'https://data.etabus.gov.hk/v1/transport/kmb/stop-eta';

// ========== GLOBAL VARIABLES ==========
let allStops = [];
let currentSelectedStop = { id: null, name: null };

// ========== UTILITY FUNCTIONS ==========
function showLoading(show = true) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function clearError() {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) errorDiv.style.display = 'none';
}

// ========== 1. FETCH ALL STOPS ==========
async function fetchAllStops() {
    showLoading(true);
    try {
        const response = await fetch(STOP_LIST_API);
        if (!response.ok) throw new Error('Failed to fetch stop list');
        const data = await response.json();
        allStops = data.data || [];
        console.log(`Loaded ${allStops.length} stops`);
        displayStopList(allStops.slice(0, 50));
    } catch (error) {
        showError('Could not load bus stop list. Please refresh.');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

// ========== 2. DISPLAY STOP LIST ==========
function displayStopList(stops) {
    const listDiv = document.getElementById('allStopsList');
    if (!listDiv) return;

    if (!stops || stops.length === 0) {
        listDiv.innerHTML = '<p>No stops found.</p>';
        return;
    }

    let html = '';
    stops.forEach(stop => {
        html += `
            <div class="stop-item" onclick="selectStop('${stop.stop}', '${stop.name_tc}')">
                <span class="stop-name">${stop.name_tc} / ${stop.name_en}</span>
                <span class="stop-id">ID: ${stop.stop}</span>
            </div>
        `;
    });
    listDiv.innerHTML = html;
}

// ========== 3. SEARCH STOPS ==========
function setupSearchListener() {
    const searchInput = document.getElementById('stopSearchInput');
    const resultsDiv = document.getElementById('searchResults');

    if (!searchInput || !resultsDiv) return;

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            resultsDiv.innerHTML = '';
            return;
        }

        const matches = allStops.filter(stop => 
            stop.name_tc.toLowerCase().includes(query) || 
            stop.name_en.toLowerCase().includes(query)
        ).slice(0, 20);

        if (matches.length === 0) {
            resultsDiv.innerHTML = '<div class="stop-item">No matching stops found</div>';
        } else {
            let html = '';
            matches.forEach(stop => {
                html += `
                    <div class="stop-item" onclick="selectStop('${stop.stop}', '${stop.name_tc}')">
                        <span class="stop-name">${stop.name_tc} / ${stop.name_en}</span>
                        <span class="stop-id">ID: ${stop.stop}</span>
                    </div>
                `;
            });
            resultsDiv.innerHTML = html;
        }
    });
}

// ========== 4. HANDLE STOP SELECTION ==========
window.selectStop = async function(stopId, stopName) {
    // Save current selected stop
    currentSelectedStop = { id: stopId, name: stopName };
    
    // Hide search UI, show arrival results
    document.querySelector('.search-section').style.display = 'none';
    document.querySelector('.or-divider').style.display = 'none';
    document.querySelector('.all-stops-section').style.display = 'none';
    document.getElementById('arrivalResultsArea').style.display = 'block';
    
    document.getElementById('selectedStopInfo').innerHTML = `<h3>Selected Stop: ${stopName} (ID: ${stopId})</h3>`;
    
    await fetchArrivals(stopId);
};

// ========== 5. FETCH ARRIVALS ==========
async function fetchArrivals(stopId) {
    const url = `${ETA_API_BASE}/${stopId}`;
    showLoading(true);
    clearError();

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        
        if (data && data.data) {
            displayArrivals(data.data);
        } else {
            showError('No arrival data found for this stop.');
            document.getElementById('results').innerHTML = '';
        }
    } catch (error) {
        showError('Failed to fetch arrival data. Please try again.');
        console.error('Fetch error:', error);
    } finally {
        showLoading(false);
    }
}

// ========== 6. PROCESS & DISPLAY ARRIVALS ==========
function processArrivals(arrivals) {
    if (!arrivals || arrivals.length === 0) return [];

    const now = new Date();
    return arrivals.map(item => {
        const etaTime = new Date(item.eta);
        const waitMs = etaTime - now;
        const waitMinutes = Math.max(0, Math.round(waitMs / 60000));

        return {
            ...item,
            waitMinutes: waitMinutes
        };
    }).sort((a, b) => a.waitMinutes - b.waitMinutes);
}

function displayArrivals(arrivals) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    const processedArrivals = processArrivals(arrivals);
    
    if (processedArrivals.length === 0) {
        resultsDiv.innerHTML = '<p>No upcoming arrivals for this stop.</p>';
        return;
    }

    const nextVehicle = processedArrivals[0];
    const nextDest = nextVehicle.dest_tc || 'N/A';
    const nextRoute = nextVehicle.route || 'N/A';

    let html = `
        <h3>🚏 Next Bus: Route ${nextRoute} to ${nextDest} in ~${nextVehicle.waitMinutes} min</h3>
        <table>
            <thead>
                <tr>
                    <th>Route</th>
                    <th>Destination (TC)</th>
                    <th>Arrival Time</th>
                    <th>Wait (min)</th>
                </tr>
            </thead>
            <tbody>
    `;

    processedArrivals.forEach(item => {
        const etaDate = new Date(item.eta);
        const timeStr = etaDate.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit' });
        html += `
            <tr>
                <td><strong>${item.route || 'N/A'}</strong></td>
                <td>${item.dest_tc || 'N/A'}</td>
                <td>${timeStr}</td>
                <td>${item.waitMinutes}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    resultsDiv.innerHTML = html;
}

// ========== 7. BACK TO BROWSE ==========
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'backToBrowseBtn') {
        document.querySelector('.search-section').style.display = 'block';
        document.querySelector('.or-divider').style.display = 'block';
        document.querySelector('.all-stops-section').style.display = 'block';
        document.getElementById('arrivalResultsArea').style.display = 'none';
        document.getElementById('stopSearchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    }
});

// ========== 8. SAVE TO FAVORITES ==========
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'saveToFavoritesBtn') {
        if (currentSelectedStop.id && currentSelectedStop.name) {
            // Pre-fill the favorites form and navigate to favorites page
            localStorage.setItem('pendingFavorite', JSON.stringify({
                stopId: currentSelectedStop.id,
                stopName: currentSelectedStop.name
            }));
            window.location.href = 'favorites.html';
        }
    }
});

// ========== 9. FAVORITES CRUD ==========
const FAVORITES_KEY = 'kmbFavorites';

// READ
function getFavorites() {
    const favJson = localStorage.getItem(FAVORITES_KEY);
    return favJson ? JSON.parse(favJson) : [];
}

// CREATE
function addFavorite(stopId, friendlyName) {
    if (!stopId || !friendlyName) {
        alert('Please enter both Stop ID and a Friendly Name');
        return false;
    }
    const favorites = getFavorites();
    if (favorites.some(fav => fav.stopId === stopId)) {
        alert('This Stop ID is already in your favorites.');
        return false;
    }
    const newFavorite = {
        id: Date.now().toString(),
        stopId: stopId.trim(),
        name: friendlyName.trim()
    };
    favorites.push(newFavorite);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    renderFavoritesList();
    return true;
}

// UPDATE
function updateFavorite(id, newName) {
    const favorites = getFavorites();
    const index = favorites.findIndex(fav => fav.id === id);
    if (index !== -1) {
        favorites[index].name = newName.trim();
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        renderFavoritesList();
        return true;
    }
    return false;
}

// DELETE
function deleteFavorite(id) {
    let favorites = getFavorites();
    favorites = favorites.filter(fav => fav.id !== id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    renderFavoritesList();
}

// RENDER FAVORITES
function renderFavoritesList() {
    const listDiv = document.getElementById('favoritesList');
    if (!listDiv) return;

    const favorites = getFavorites();
    if (favorites.length === 0) {
        listDiv.innerHTML = '<p class="no-favorites">You have no favorite stops saved yet.</p>';
        return;
    }

    let html = '<h3>Your Saved Stops</h3>';
    favorites.forEach(fav => {
        html += `
            <div class="favorite-item" data-id="${fav.id}">
                <span><strong>${fav.name}</strong> <span class="stop-id">${fav.stopId}</span></span>
                <div>
                    <button class="edit" onclick="editFavoritePrompt('${fav.id}', '${fav.name}')">Rename</button>
                    <button class="delete" onclick="deleteFavorite('${fav.id}')">Delete</button>
                    <button class="view" onclick="viewFavoriteArrivals('${fav.stopId}', '${fav.name}')">View Times</button>
                </div>
            </div>
        `;
    });
    listDiv.innerHTML = html;
}

// Edit prompt
window.editFavoritePrompt = function(id, currentName) {
    const newName = prompt('Enter new name for this stop:', currentName);
    if (newName && newName.trim() !== '') {
        updateFavorite(id, newName.trim());
    }
};

// View arrivals from favorites
window.viewFavoriteArrivals = function(stopId, stopName) {
    window.location.href = `browse-stops.html?stop=${stopId}&name=${encodeURIComponent(stopName)}`;
};

// ========== 10. INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    // Check which page we're on
    const path = window.location.pathname;
    
    // Browse stops page
    if (path.includes('browse-stops.html') || document.getElementById('allStopsList')) {
        fetchAllStops();
        setupSearchListener();

        // Check for URL parameters (from favorites)
        const urlParams = new URLSearchParams(window.location.search);
        const stopId = urlParams.get('stop');
        const stopName = urlParams.get('name');
        if (stopId && stopName) {
            setTimeout(() => {
                selectStop(stopId, stopName);
            }, 500);
        }
    }
    
    // Favorites page
    if (path.includes('favorites.html') || document.getElementById('favoritesList')) {
        renderFavoritesList();
        
        // Check for pending favorite from browse page
        const pendingFav = localStorage.getItem('pendingFavorite');
        if (pendingFav) {
            const fav = JSON.parse(pendingFav);
            document.getElementById('newFavStopId').value = fav.stopId;
            document.getElementById('newFavName').value = fav.stopName + ' Stop';
            localStorage.removeItem('pendingFavorite');
        }
        
        // Add favorite button
        const addFavBtn = document.getElementById('addFavoriteBtn');
        if (addFavBtn) {
            addFavBtn.addEventListener('click', () => {
                const stopId = document.getElementById('newFavStopId').value.trim();
                const name = document.getElementById('newFavName').value.trim();
                if (addFavorite(stopId, name)) {
                    document.getElementById('newFavStopId').value = '';
                    document.getElementById('newFavName').value = '';
                }
            });
        }
    }
});

// Expose functions globally
window.deleteFavorite = deleteFavorite;
window.viewFavoriteArrivals = viewFavoriteArrivals;