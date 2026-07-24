# PorciControl 🐷

App móvil para el control reproductivo de cerdas en granjas porcinas. Permite registrar y hacer seguimiento del ciclo completo: cruce → gestación → parto → lactancia → destete.

## ¿Para qué sirve?

- Registrar madres (cerdas reproductoras) con su arete y estado
- Gestionar ciclos reproductivos: cruce (monta natural o inseminación), parto y destete
- Ver alertas automáticas de partos próximos, destetes pendientes y madres listas para cruce
- Consultar reportes y estadísticas del plantel
- Todo se guarda localmente en el navegador (sin necesidad de servidor)

## Tecnologías

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- React Router (HashRouter)
- localStorage para persistencia de datos

## Correr localmente

```sh
npm install
npm run dev
```

## Deploy en GitHub Pages

```sh
npm run deploy
```

La app queda disponible en: `https://<tu-usuario>.github.io/porci-control-app/`
