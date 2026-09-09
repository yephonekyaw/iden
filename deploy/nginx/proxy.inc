# Settings shared by every proxied location.
#
# Deliberately not `include /etc/nginx/proxy_params`: that file ships with
# Debian's nginx *package*, not with nginx, and is absent from the official
# image — a config that includes it will not start there.
#
# Included as .inc rather than .conf so nginx's own `include conf.d/*.conf`
# does not load it a second time as a server configuration.

# 1.0 is the default to upstreams, and it disables keepalive: without this every
# proxied request opens a fresh connection to the provider.
proxy_http_version 1.1;
# Emptied so the upstream keepalive pool is used; nginx would otherwise forward
# the client's own `Connection: close`.
proxy_set_header Connection "";

proxy_set_header Host      $host;
proxy_set_header X-Real-IP $remote_addr;

# One value, not a chain. `real_ip` has already replaced $remote_addr with the
# address Cloudflare saw, and sending exactly that spares the application
# walking a list whose correctness would depend on knowing every hop that
# appended to it. IDEN_FORWARDED_ALLOW_IPS decides whether it is believed.
proxy_set_header X-Forwarded-For $remote_addr;

# Passed through rather than asserted: Cloudflare sets it, and if it ever says
# `http` the honest thing is to say so too. Empty is ignored downstream.
proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
