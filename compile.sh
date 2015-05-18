cd contracts
solc --input-file namereg.sol --optimize=1 --binary=both --json-abi=both
solc --input-file rep.sol --optimize=1 --binary=both --json-abi=both
cd ..
