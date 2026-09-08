/* NavbarComponent: A standalone Angular component for the application's navigation bar.
 * @version 1.0
 *
 */
import { Component, inject } from '@angular/core';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [],
  templateUrl: './NavbarComponent.html',
  styleUrl: './NavbarComponent.scss',
})
export class NavbarComponent {
  authService = inject(AuthService);

  title = 'NeuroApp v1.0';
}
