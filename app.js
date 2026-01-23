let map;
let ambulanceMarker, hospitalMarker, routeLayer;
let lastLatLng = null;

/* ================= AMBULANCE ICON ================= */
const ambulanceIcon = L.divIcon({
    html: "🚑",
    className: "ambulance-icon",
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

/* ================= HOSPITAL DATA ================= */
const hospitals = [
    { name: "Apollo Hospital", lat: 17.4108, lng: 78.3983 },
    { name: "Care Hospital",   lat: 17.3920, lng: 78.4483 },
    { name: "City Hospital",   lat: 17.3850, lng: 78.4867 }
];

/* ================= DISTANCE ================= */
function distance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) ** 2 +
        Math.cos(lat1 * Math.PI/180) *
        Math.cos(lat2 * Math.PI/180) *
        Math.sin(dLon/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ================= NEAREST HOSPITAL ================= */
function findNearestHospital(lat, lng) {
    let nearest = hospitals[0];
    let minDist = distance(lat, lng, nearest.lat, nearest.lng);

    hospitals.forEach(h => {
        const d = distance(lat, lng, h.lat, h.lng);
        if (d < minDist) {
            minDist = d;
            nearest = h;
        }
    });
    return nearest;
}

/* ================= SMOOTH GPS MOVE ================= */
function smoothMove(marker, from, to) {
    const steps = 10;
    let step = 0;

    const latStep = (to[0] - from[0]) / steps;
    const lngStep = (to[1] - from[1]) / steps;

    const interval = setInterval(() => {
        step++;
        marker.setLatLng([
            from[0] + latStep * step,
            from[1] + lngStep * step
        ]);
        if (step === steps) clearInterval(interval);
    }, 100);
}

/* ================= AMBULANCE SIDE ================= */
function initAmbulanceMap() {
    map = L.map("map").setView([17.3850, 78.4867], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(map);
}

function startTracking() {
    const id = document.getElementById("ambulanceId").value;
    const status = document.getElementById("status");

    status.className = "status active";
    status.innerText = "Status: Tracking live GPS...";

    navigator.geolocation.watchPosition(async pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const hospital = findNearestHospital(lat, lng);
        const km = distance(lat, lng, hospital.lat, hospital.lng);
        const eta = (km / 40 * 60).toFixed(1);

        /* CREATE MARKER FIRST TIME */
        if (!ambulanceMarker) {
            ambulanceMarker = L.marker([lat, lng], {
                icon: ambulanceIcon
            }).addTo(map);

            hospitalMarker = L.marker([hospital.lat, hospital.lng])
                .addTo(map)
                .bindPopup("🏥 " + hospital.name);

            // DRAW ROUTE ONCE
            const url =
                `https://router.project-osrm.org/route/v1/driving/` +
                `${lng},${lat};${hospital.lng},${hospital.lat}` +
                `?overview=full&geometries=geojson`;

            const res = await fetch(url);
            const json = await res.json();

            const routePoints =
                json.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

            routeLayer = L.polyline(routePoints, {
                color: "red",
                weight: 5
            }).addTo(map);

            map.fitBounds(routeLayer.getBounds());

            lastLatLng = [lat, lng];
        } else {
            // MOVE BASED ON REAL GPS
            smoothMove(ambulanceMarker, lastLatLng, [lat, lng]);
            lastLatLng = [lat, lng];
        }

        /* SHARE DATA FOR POLICE */
        localStorage.setItem("AMB_DATA", JSON.stringify({
            id,
            lat,
            lng,
            hospital,
            distance: km.toFixed(2),
            eta,
            time: new Date().toLocaleTimeString()
        }));

        status.innerHTML =
            `Status: Emergency Active<br>
             Destination: ${hospital.name}<br>
             Distance: ${km.toFixed(2)} km<br>
             ETA: ${eta} min`;

    }, () => alert("Location permission denied"), {
        enableHighAccuracy: true,
        maximumAge: 0
    });
}

/* ================= POLICE SIDE ================= */
function initPoliceMap() {
    map = L.map("map").setView([17.3850, 78.4867], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(map);

    setInterval(updatePoliceMap, 1500);
}

function updatePoliceMap() {
    const stored = localStorage.getItem("AMB_DATA");
    if (!stored) return;

    const data = JSON.parse(stored);

    document.getElementById("info").innerHTML =
        `<b>Ambulance:</b> ${data.id}<br>
         <b>Destination:</b> ${data.hospital.name}<br>
         <b>Distance:</b> ${data.distance} km<br>
         <b>ETA:</b> ${data.eta} min<br>
         <b>Updated:</b> ${data.time}`;

    if (!ambulanceMarker) {
        ambulanceMarker = L.marker([data.lat, data.lng], {
            icon: ambulanceIcon
        }).addTo(map);
    } else {
        ambulanceMarker.setLatLng([data.lat, data.lng]);
    }

    if (!hospitalMarker) {
        hospitalMarker = L.marker([data.hospital.lat, data.hospital.lng])
            .addTo(map)
            .bindPopup("🏥 " + data.hospital.name);
    }
}
