import React, { useEffect, useState, useContext } from "react";
import PokemonDisplay from "./Components/PokemonDisplay";
import PokemonContextProvider from "./Components/PokemonContext";

const App = () => {
  return (
    <PokemonContextProvider>
      <h1>This pokemon has =></h1>

      <PokemonDisplay />
    </PokemonContextProvider>
  );
};

export default App;