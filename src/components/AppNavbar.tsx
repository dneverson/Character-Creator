import { useLayoutEffect, useRef } from 'react'
import Container from 'react-bootstrap/Container'
import Navbar from 'react-bootstrap/Navbar'
import { AccountButton } from './account/AccountButton'
import { ContentButton } from './content/ContentButton'
import { BooksButton } from './books/BooksButton'
import { LookupButton } from './lookup/LookupButton'
import { ThemeToggle } from './ThemeToggle'
import { BrandEmblem } from './BrandEmblem'
import { account } from '../cloud'
import { appConfig } from '../config/app'

/** Top navigation bar with the app title, the book content status and the theme switcher. */
export function AppNavbar() {
  const ref = useRef<HTMLElement>(null)
  // Sticky section headers hang below the navbar, whose height changes as it wraps.
  useLayoutEffect(() => {
    const publish = () => {
      const height = ref.current?.getBoundingClientRect().height ?? 0
      document.documentElement.style.setProperty('--app-navbar-height', `${height}px`)
    }
    publish()
    window.addEventListener('resize', publish)
    return () => window.removeEventListener('resize', publish)
  }, [])
  return (
    <Navbar
      ref={ref}
      expand="md"
      className="border-bottom"
      sticky="top"
      bg="body-tertiary"
    >
      <Container>
        <Navbar.Brand className="fw-bold d-flex align-items-center">
          <BrandEmblem />
          {/* A phone has no room for the full name beside the buttons. */}
          <span className="ms-2 d-none d-sm-inline">{appConfig.name}</span>
          <span className="ms-2 d-sm-none">{appConfig.shortName}</span>
        </Navbar.Brand>
        <div className="ms-auto d-flex align-items-center gap-2">
          <BooksButton />
          <LookupButton />
          <ContentButton />
          <AccountButton account={account} />
          <ThemeToggle />
        </div>
      </Container>
    </Navbar>
  )
}
