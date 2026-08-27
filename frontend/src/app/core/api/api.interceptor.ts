import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '@env/environment';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const [path, query] = req.url.split('?');
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  const url = `${environment.BACKEND_URL.replace(/\/$/, '')}/${cleanPath}/${
    query ? `?${query}` : ''
  }`;
  return next(req.clone({ url, withCredentials: true }));
};