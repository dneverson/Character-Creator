import Container from 'react-bootstrap/Container'
import Navbar from 'react-bootstrap/Navbar'
import { ContentButton } from './content/ContentButton'
import { ThemeToggle } from './ThemeToggle'
import { BrandEmblem } from './BrandEmblem'
import { appConfig } from '../config/app'

/** Top navigation bar with the app title, the book content status and the theme switcher. */
export function AppNavbar() {
  return (
    <Navbar expand="md" className="border-bottom" sticky="top" bg="body-tertiary">
      <Container>
        <Navbar.Brand className="fw-bold d-flex align-items-center">
          <BrandEmblem />
          {/* A phone has no room for the full name beside the buttons. */}
          <span className="ms-2 d-none d-sm-inline">{appConfig.name}</span>
          <span className="ms-2 d-sm-none">{appConfig.shortName}</span>
        </Navbar.Brand>
        <div className="ms-auto d-flex align-items-center gap-2">
          <ContentButton />
          <ThemeToggle />
        </div>
      </Container>
    </Navbar>
  )
}
