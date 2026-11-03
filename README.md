# AppFloci: gestión de comprobantes

Aplicación web para registrar y consultar boletas y facturas utilizando Express y servicios de AWS emulados localmente con Floci. Permite adjuntar imágenes JPG o PNG de hasta 5 MB, consultar el análisis simulado y enviar cada registro a revisión.

## 1. Servicios y funcionamiento

| Servicio | Función en el proyecto |
| --- | --- |
| **Amazon Textract** | Recibe la imagen y devuelve una respuesta JSON simulada. |
| **Amazon S3** | Guarda la imagen del comprobante. |
| **Amazon DynamoDB** | Guarda los datos del formulario, el JSON, la referencia a la imagen y el estado. |
| **Amazon SQS** | Recibe una tarea con el identificador del comprobante. |
| **AWS Lambda** | Procesa la tarea y marca el comprobante como «Necesita revisión». |

```text
Formulario e imagen → Express → Textract → S3 → DynamoDB → SQS → Lambda
                                                    ↑              │
                                                    └── estado ────┘
```

La tabla consulta DynamoDB y permite ver la imagen almacenada en S3, consultar el JSON de Textract y eliminar el registro junto con su imagen. Si el envío a SQS falla, el registro permanece guardado y la pantalla muestra un aviso; actualmente el envío no se reintenta automáticamente.

**Sobre la simulación:** Floci puede devolver datos de ejemplo como la palabra `Floci`. No se debe considerar que esos datos fueron extraídos realmente de la imagen. La revisión de Lambda es una demostración y deja el comprobante para revisión humana.

## 2. Requisitos

- Node.js y npm.
- Docker en ejecución y acceso a su comando `docker`.
- Floci instalado. AWS CLI es necesario solo para las comprobaciones y los comandos manuales opcionales.
- `zip`, utilizado para empaquetar Lambda.
- Git, para descargar el proyecto.

Comprueba las herramientas desde una terminal:

```bash
node --version
npm --version
docker --version
docker ps
floci --version
aws --version
zip -v
```

`docker ps` debe mostrar una tabla de contenedores; puede estar vacía. Si Docker devuelve un error, revisa que el servicio esté iniciado y que tu usuario tenga acceso.

## 3. Descargar e instalar

```bash
git clone https://github.com/Pineda-25/AppFloci.git
cd AppFloci
npm install
```

Al terminar, npm muestra un resumen de las dependencias instaladas. Si ya descargaste el proyecto, basta con entrar a su carpeta con `cd`.

## 4. Configurar variables

Crea tu archivo local a partir de la plantilla:

```bash
cp .env.example .env
```

Ejecuta este paso solo al configurar el proyecto por primera vez: copiar encima de un `.env` existente reemplaza tus cambios. Abre `.env` en tu editor y revisa:

| Variable | Para qué sirve |
| --- | --- |
| `PORT` | Puerto donde Express inicia la aplicación. |
| `AWS_REGION` | Región utilizada para los recursos de Floci. |
| `AWS_ENDPOINT_URL` | Dirección local de Floci accesible desde tu equipo. |
| `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` | Credenciales de prueba del emulador. |
| `AWS_S3_BUCKET` | Nombre del bucket donde se guardan las imágenes. |
| `AWS_DYNAMODB_TABLE` | Nombre de la tabla de comprobantes. |
| `AWS_SQS_QUEUE_NAME` | Nombre de la cola de revisión. |

La plantilla contiene valores de ejemplo. El puerto de Express y la dirección de Floci pueden variar según tu equipo. El archivo `.env` no se sube a Git; usa credenciales de prueba locales y no publiques claves reales.

## 5. Iniciar Floci y preparar recursos

Inicia Floci y consulta su estado:

```bash
floci start
floci status
floci services
```

`floci start` debe indicar que el emulador está listo. En la lista de servicios comprueba que aparezcan `s3`, `dynamodb`, `textract`, `sqs` y `lambda`. La dirección que muestre Floci debe coincidir con `AWS_ENDPOINT_URL` en `.env`.

Desde la carpeta del proyecto ejecuta:

```bash
npm run setup:floci
```

El script busca o crea el bucket, la tabla, la cola, la función Lambda y la conexión entre SQS y Lambda. La salida indica si cada recurso fue creado o ya existía, y termina con `Recursos de Floci preparados.`. Puedes repetirlo: conserva los recursos existentes.

El script obtiene la IP de Docker de Floci para Lambda y la actualiza cuando cambia. Para una función Lambda existente **no actualiza su código**; si se modifica, hay que actualizarlo por separado. La preparación automática usa el puerto interno habitual del contenedor Floci; si cambias su configuración de red, revisa `scripts/setup-floci.js`.

Los recursos del emulador pueden desaparecer al reiniciar o recrear el contenedor, según su configuración de almacenamiento. `setup:floci` puede recrear los recursos vacíos, pero **no recupera registros ni imágenes perdidos**.

## 6. Iniciar la aplicación

```bash
npm run dev
```

La terminal muestra la dirección local donde está disponible Express. Abre en el navegador esa dirección y el puerto configurado en `PORT`. Para detener el servidor, pulsa `Ctrl+C`. También puedes usar `npm start` para iniciarlo sin reinicio automático al cambiar el código.

Para sesiones posteriores, el orden habitual es:

```bash
floci start
cd /ruta/a/AppFloci
npm run setup:floci
npm run dev
```

Sustituye `/ruta/a/AppFloci` por la ruta real de tu copia.

## 7. Probar la aplicación

1. Selecciona **Boleta** o **Factura**, indica la fecha, el usuario y la tienda; la observación es opcional.
2. Adjunta una imagen JPG o PNG y pulsa **Registrar comprobante**.
3. Debe aparecer un mensaje de confirmación con el identificador y el registro debe mostrarse en la tabla.
4. Pulsa **Ver imagen** para abrir el archivo y **Ver JSON** para consultar la respuesta simulada de Textract.
5. Espera unos segundos y actualiza la página: Lambda debería cambiar el estado de `Pendiente` a `Necesita revisión`.
6. Para probar la eliminación, selecciona un registro de prueba, pulsa **Eliminar** y confirma. La fila debe desaparecer.

La actualización del estado es asíncrona; no necesariamente aparece inmediatamente. Si el registro se guardó pero no se pudo enviar a la cola, la aplicación muestra un aviso y permanece pendiente.

## 8. Comprobar cada servicio

Con Floci iniciado y los recursos preparados, ejecuta desde la carpeta del proyecto:

```bash
npm run check:s3
npm run check:dynamodb
npm run check:sqs
```

Se espera un mensaje de conexión correcta para S3, una tabla DynamoDB con estado `ACTIVE` y la dirección de la cola SQS. Para Textract, cambia la ruta por la de una imagen JPG o PNG de tu equipo:

```bash
npm run check:textract -- /ruta/a/imagen.jpg
```

La respuesta contiene un JSON con `DocumentMetadata`, `Blocks` y metadatos HTTP. Un `httpStatusCode` de `200` indica que la solicitud fue atendida; el contenido puede ser simulado.

Para comprobar Lambda y SQS conjuntamente, registra un comprobante desde la aplicación y verifica el cambio de estado descrito en la sección anterior. La conexión automática se prepara mediante `setup:floci`.

## 9. Errores encontrados y soluciones

| Mensaje o situación | Causa posible y solución |
| --- | --- |
| `ECONNREFUSED` | La aplicación no encontró Floci en el puerto indicado. Inicia Floci con `floci start` y revisa `AWS_ENDPOINT_URL`. |
| `NoSuchBucket` | El bucket no existe en la instancia actual. Ejecuta `npm run setup:floci`. |
| `Table ... not found` | La tabla no existe. Ejecuta `npm run setup:floci`. |
| `The specified queue does not exist` | La cola no existe. Ejecuta `npm run setup:floci`. |
| `ResourceInUseException: Table already exists` | Se intentó crear manualmente una tabla existente. Usa `npm run setup:floci`, que primero la comprueba. |
| `Task timed out` en Lambda | La función agotó su tiempo. Revisa que Floci y Docker estén activos, ejecuta `npm run setup:floci` para actualizar la dirección y consulta los registros. |
| El formulario informa que no pudo enviar a la cola | El comprobante quedó guardado, pero la revisión automática no se inició. Comprueba SQS y los registros del servidor. |
| La tabla no muestra los datos anteriores | Los datos locales pueden haberse perdido al reiniciar el contenedor. El script recrea recursos, pero no restaura su contenido. |

Para revisar los registros de Floci:

```bash
docker logs --tail 60 floci
```

Los errores del servidor Express aparecen en la terminal donde se ejecuta `npm run dev`.

## 10. Estructura principal

```text
AppFloci/
├── lambda/revision/       # Función que procesa tareas de SQS
├── public/                # Formulario, tabla y comportamiento de la página
├── scripts/               # Preparación y comprobaciones de Floci
├── src/config/            # Configuración de los clientes AWS
├── src/server.js          # Servidor Express y rutas
├── .env.example           # Plantilla de configuración local
└── package.json           # Dependencias y comandos
```
