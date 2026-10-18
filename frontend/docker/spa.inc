# Fichiers produits par Vite : nom versionné, cache long
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
}

# Configuration propre à chaque environnement : jamais en cache
location = /config.json {
    add_header Cache-Control "no-store";
}

# Application monopage : toute route inconnue renvoie index.html
location / {
    add_header Cache-Control "no-cache";
    try_files $uri /index.html;
}
