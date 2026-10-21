# MAPLASA

Plataforma para crear formularios de reclutamiento y encuestas anónimas de clima laboral. Hay una sola empresa: el equipo de RH administra los formularios y las personas que responden no necesitan cuenta.

## Requisitos

- Node.js 20 o superior
- Yarn 1
- MongoDB en ejecución

## Instalación

```bash
yarn install
cp .env.example .env
```

Genera un secreto propio y sustitúyelo en `.env`:

```bash
openssl rand -base64 32
```

Variables:

- `MONGODB_URI`: cadena de conexión completa. El nombre de la base es el texto que va después de la barra del host. La aplicación conecta con esa URI y no elige ni agrega un nombre.
- `AUTH_SECRET`: secreto de Auth.js para cifrar la cookie de sesión.
- `AUTH_URL`: URL pública de la aplicación.
- `APP_URL`: origen usado en enlaces y códigos QR. Si no se define, se toma el host de la solicitud.

## Primer administrador

No hay credenciales predeterminadas ni registro público.

```bash
yarn dev
```

Abre [http://localhost:3000/setup](http://localhost:3000/setup) y crea la primera cuenta. El formulario deja de funcionar en cuanto existe un usuario. Después entra en `/login`.

## Datos de desarrollo

`yarn seed` crea competencias, áreas y un formulario de reclutamiento de ejemplo. No crea candidatos ni respuestas. Requiere que el administrador ya exista.

## Scripts

```bash
yarn dev
yarn test
yarn lint
yarn build
yarn start
```

## Cómo se usa

1. Crea competencias y, si harás clima laboral, áreas.
2. Crea un formulario, configura preguntas y guárdalo.
3. Publícalo. La primera publicación genera un enlace. Las siguientes no cambian los enlaces anteriores.
4. Para clima laboral, crea un enlace por área. El QR codifica `/f/{token}` y el servidor resuelve formulario, versión y área.
5. Comparte el enlace. La página pública no muestra el menú administrativo.
6. Revisa postulaciones, puntuaciones y resultados agregados.

## Puntuación de reclutamiento

Se calcula en el servidor con la versión publicada:

- Cada opción puntuable vale de 0 a 5.
- La puntuación de una competencia es el promedio de sus respuestas puntuables, dividido entre 5 y multiplicado por 100.
- La puntuación global es el promedio de las competencias evaluadas, con el mismo peso para cada competencia.
- Las preguntas de texto no puntúan.
- Si no hay competencias evaluables, el resultado es nulo y la interfaz muestra «Sin puntuación».

## Clima laboral y anonimato

Las respuestas anónimas no guardan nombre, correo, usuario, IP ni agente de navegador. Un límite de solicitudes en memoria reduce reintentos abusivos, pero no se escribe en la respuesta ni identifica a nadie.

El acceso es público. Eso no garantiza una sola participación por empleado. La clave de idempotencia solo evita que un doble clic duplique la misma solicitud.

Los agregados y su CSV se muestran cuando el corte tiene al menos cinco respuestas y los filtros no permiten reconstruir un grupo menor por diferencia. Las respuestas abiertas se almacenan sin identificadores y no se listan en esta versión.

## Seguimiento

La permanencia se calcula con la fecha de ingreso y, si aplica, la de salida. Las estadísticas son descriptivas: no predicen renuncias ni contratan o rechazan de forma automática.
