import React from 'react'
import { useAuth } from '../auth/AuthContext'
import { Box, Flex, Heading, Spacer, Button, Avatar, HStack, Skeleton, Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react'

export default function Navbar() {
  const { user, login, logout, loading } = useAuth()
  return (
    <Box position="sticky" top={0} zIndex={10} borderBottom="1px" borderColor="gray.200" bg="white">
      <Flex align="center" px={4} py={3}>
        <Heading as="h1" fontSize="lg">Discord Dashboard</Heading>
        <Spacer />
        <HStack spacing={3}>
          {loading && <Skeleton height="32px" width="120px" />}
          {!loading && !user && (
            <Button colorScheme="blue" onClick={login}>Войти через Discord</Button>
          )}
          {!loading && user && (
            <Menu>
              <MenuButton as={Button} variant="ghost" rightIcon={null} px={2}>
                <HStack spacing={2}>
                  <Avatar size="sm" name={user?.username} src={`https://cdn.discordapp.com/avatars/${user?.id}/${user?.avatar}.png?size=64`} />
                  <Box as="span" fontWeight="medium">{user?.username}</Box>
                </HStack>
              </MenuButton>
              <MenuList>
                <MenuItem onClick={logout}>Выйти</MenuItem>
              </MenuList>
            </Menu>
          )}
        </HStack>
      </Flex>
    </Box>
  )
}
