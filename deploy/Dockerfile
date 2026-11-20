FROM nginx:1.27-alpine

# The nginx image fills in ${API_UPSTREAM} from the environment at startup
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY src /usr/share/nginx/html
