.PHONY: dev-run prod-run

dev-run:
	./node_modules/.bin/electron-vite dev -w

prod-run:
	./node_modules/.bin/electron-vite build
	./node_modules/.bin/electron-vite preview
